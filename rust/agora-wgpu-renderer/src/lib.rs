use bytemuck::{Pod, Zeroable};
use std::collections::HashMap;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
struct CameraUniform {
    camera_x: f32,
    camera_y: f32,
    camera_scale: f32,
    _pad0: f32,
    viewport_width: f32,
    viewport_height: f32,
    _pad1: f32,
    _pad2: f32,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct SpriteInstance {
    pub center: [f32; 2],
    pub offset: [f32; 2],
    pub size: [f32; 2],
    pub uv_min: [f32; 2],
    pub uv_max: [f32; 2],
    pub rotation: f32,
    pub tint: u32,
}

struct TextureEntry {
    texture: wgpu::Texture,
    bind_group: wgpu::BindGroup,
    width: u32,
    height: u32,
}

#[derive(Clone, Copy)]
struct DrawBatch {
    tex_id: u32,
    start: u32,
    count: u32,
}

#[wasm_bindgen]
pub struct WgpuCanvasRenderer {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    texture_bind_group_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    instance_buffer: wgpu::Buffer,
    instance_capacity: usize,
    textures: HashMap<u32, TextureEntry>,
    cached_batches: Vec<DrawBatch>,
    backend_name: String,
    adapter_description: String,
    width: u32,
    height: u32,
    device_failed: Arc<AtomicBool>,
}

async fn try_init_backend(
    canvas: &HtmlCanvasElement,
    backends: wgpu::Backends,
) -> Result<(wgpu::Surface<'static>, wgpu::Adapter, wgpu::Device, wgpu::Queue), String> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends,
        ..Default::default()
    });
    let surface = instance
        .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
        .map_err(|e| format!("surface error: {e}"))?;
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        })
        .await
        .ok_or_else(|| "no suitable GPU adapter".to_string())?;

    let info = adapter.get_info();
    let lower_name = format!("{} {} {:?}", info.name, info.driver, info.device_type).to_lowercase();
    if info.device_type == wgpu::DeviceType::Cpu
        || lower_name.contains("swiftshader")
        || lower_name.contains("llvmpipe")
        || lower_name.contains("softpipe")
        || lower_name.contains("software")
    {
        return Err("software adapter rejected".to_string());
    }

    let required_limits = wgpu::Limits::downlevel_webgl2_defaults().using_resolution(adapter.limits());
    let (device, queue) = adapter
        .request_device(
            &wgpu::DeviceDescriptor {
                label: Some("agora-wgpu-device"),
                required_features: wgpu::Features::empty(),
                required_limits,
                memory_hints: wgpu::MemoryHints::Performance,
            },
            None,
        )
        .await
        .map_err(|e| format!("device error: {e}"))?;

    Ok((surface, adapter, device, queue))
}

#[wasm_bindgen]
impl WgpuCanvasRenderer {
    pub async fn create(
        canvas: HtmlCanvasElement,
        width: u32,
        height: u32,
        prefer_webgl: bool,
    ) -> Result<WgpuCanvasRenderer, JsValue> {
        let width = width.max(1);
        let height = height.max(1);
        canvas.set_width(width);
        canvas.set_height(height);

        let order = if prefer_webgl {
            [wgpu::Backends::GL, wgpu::Backends::BROWSER_WEBGPU]
        } else {
            [wgpu::Backends::BROWSER_WEBGPU, wgpu::Backends::GL]
        };

        let mut init_result = None;
        let mut last_err = String::new();
        for backend in order {
            match try_init_backend(&canvas, backend).await {
                Ok(ok) => {
                    init_result = Some(ok);
                    break;
                }
                Err(err) => {
                    last_err = err;
                }
            }
        }

        let (surface, adapter, device, queue) =
            init_result.ok_or_else(|| JsValue::from_str(&last_err))?;

        let info = adapter.get_info();
        let backend_name = match info.backend {
            wgpu::Backend::BrowserWebGpu => "webgpu".to_string(),
            _ => "webgl".to_string(),
        };
        let adapter_description = if info.name.is_empty() {
            format!("{:?}", info.backend)
        } else {
            info.name.clone()
        };

        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| !f.is_srgb())
            .or_else(|| caps.formats.first().copied())
            .ok_or_else(|| JsValue::from_str("no surface format"))?;

        let alpha_mode = if caps
            .alpha_modes
            .contains(&wgpu::CompositeAlphaMode::PreMultiplied)
        {
            wgpu::CompositeAlphaMode::PreMultiplied
        } else {
            caps.alpha_modes
                .first()
                .copied()
                .unwrap_or(wgpu::CompositeAlphaMode::Auto)
        };

        let max_dim = device.limits().max_texture_dimension_2d.max(1);
        let clamped_w = width.min(max_dim);
        let clamped_h = height.min(max_dim);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: clamped_w,
            height: clamped_h,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode,
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("agora-wgpu-sprite-shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
        });

        let camera_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("agora-camera-buffer"),
            size: std::mem::size_of::<CameraUniform>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let camera_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("agora-camera-bgl"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });

        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("agora-camera-bg"),
            layout: &camera_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: camera_buffer.as_entire_binding(),
            }],
        });

        let texture_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("agora-texture-bgl"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            multisampled: false,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("agora-sprite-sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("agora-pipeline-layout"),
            bind_group_layouts: &[&camera_bind_group_layout, &texture_bind_group_layout],
            push_constant_ranges: &[],
        });

        let instance_layout = wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<SpriteInstance>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Instance,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: 8,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: 16,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: 24,
                    shader_location: 3,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: 32,
                    shader_location: 4,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: 40,
                    shader_location: 5,
                    format: wgpu::VertexFormat::Float32,
                },
                wgpu::VertexAttribute {
                    offset: 44,
                    shader_location: 6,
                    format: wgpu::VertexFormat::Uint32,
                },
            ],
        };

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("agora-sprite-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[instance_layout],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let initial_capacity = 256usize;
        let instance_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("agora-instance-buffer"),
            size: (initial_capacity * std::mem::size_of::<SpriteInstance>()) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Surface/context loss must return control to the cached Canvas2D path,
        // rather than letting wgpu's default uncaptured-error handler panic.
        let device_failed = Arc::new(AtomicBool::new(false));
        let lost = device_failed.clone();
        device.set_device_lost_callback(move |_, _| { lost.store(true, Ordering::Relaxed); });
        let failed = device_failed.clone();
        device.on_uncaptured_error(Box::new(move |_| { failed.store(true, Ordering::Relaxed); }));

        Ok(WgpuCanvasRenderer {
            surface,
            device,
            queue,
            config,
            pipeline,
            camera_buffer,
            camera_bind_group,
            texture_bind_group_layout,
            sampler,
            instance_buffer,
            instance_capacity: initial_capacity,
            textures: HashMap::new(),
            cached_batches: Vec::new(),
            backend_name,
            adapter_description,
            width: clamped_w,
            height: clamped_h,
            device_failed,
        })
    }

    pub fn backend_kind(&self) -> String {
        self.backend_name.clone()
    }

    pub fn adapter_name(&self) -> String {
        self.adapter_description.clone()
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        let max_dim = self.device.limits().max_texture_dimension_2d.max(1);
        let w = width.max(1).min(max_dim);
        let h = height.max(1).min(max_dim);
        if w == self.width && h == self.height {
            return;
        }
        self.width = w;
        self.height = h;
        self.config.width = w;
        self.config.height = h;
        self.surface.configure(&self.device, &self.config);
    }

    pub fn upload_canvas_texture(
        &mut self,
        tex_id: u32,
        source: &HtmlCanvasElement,
        width: u32,
        height: u32,
    ) -> bool {
        let max_dim = self.device.limits().max_texture_dimension_2d.max(1);
        let w = width.max(1).min(max_dim);
        let h = height.max(1).min(max_dim);
        if source.width() == 0 || source.height() == 0 {
            return false;
        }

        let recreate = match self.textures.get(&tex_id) {
            Some(existing) => existing.width != w || existing.height != h,
            None => true,
        };

        if recreate {
            let texture = self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("agora-atlas-texture"),
                size: wgpu::Extent3d {
                    width: w,
                    height: h,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::TEXTURE_BINDING
                    | wgpu::TextureUsages::COPY_DST
                    | wgpu::TextureUsages::RENDER_ATTACHMENT,
                view_formats: &[],
            });
            let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
            let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("agora-atlas-bg"),
                layout: &self.texture_bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                ],
            });
            self.textures.insert(
                tex_id,
                TextureEntry {
                    texture,
                    bind_group,
                    width: w,
                    height: h,
                },
            );
        }

        if let Some(entry) = self.textures.get(&tex_id) {
            let copy_w = w.min(source.width());
            let copy_h = h.min(source.height());
            self.queue.copy_external_image_to_texture(
                &wgpu::CopyExternalImageSourceInfo {
                    source: wgpu::ExternalImageSource::HTMLCanvasElement(source.clone()),
                    origin: wgpu::Origin2d::ZERO,
                    flip_y: false,
                },
                wgpu::CopyExternalImageDestInfo {
                    texture: &entry.texture,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                    color_space: wgpu::PredefinedColorSpace::Srgb,
                    premultiplied_alpha: true,
                },
                wgpu::Extent3d {
                    width: copy_w,
                    height: copy_h,
                    depth_or_array_layers: 1,
                },
            );
            true
        } else {
            false
        }
    }

    pub fn remove_texture(&mut self, tex_id: u32) {
        if let Some(entry) = self.textures.remove(&tex_id) {
            entry.texture.destroy();
        }
    }

    pub fn update_scene(
        &mut self,
        instance_words: &[u32],
        batch_tex_ids: &[u32],
        batch_starts: &[u32],
        batch_counts: &[u32],
    ) {
        let words_per_instance = std::mem::size_of::<SpriteInstance>() / 4;
        let instance_count = instance_words.len() / words_per_instance;
        if instance_count > self.instance_capacity {
            let next_cap = instance_count.next_power_of_two().max(256);
            self.instance_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("agora-instance-buffer"),
                size: (next_cap * std::mem::size_of::<SpriteInstance>()) as u64,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            self.instance_capacity = next_cap;
        }
        if !instance_words.is_empty() {
            self.queue.write_buffer(
                &self.instance_buffer,
                0,
                bytemuck::cast_slice(instance_words),
            );
        }
        self.cached_batches.clear();
        let n = batch_tex_ids
            .len()
            .min(batch_starts.len())
            .min(batch_counts.len());
        self.cached_batches.reserve(n);
        for i in 0..n {
            if batch_counts[i] > 0 {
                self.cached_batches.push(DrawBatch {
                    tex_id: batch_tex_ids[i],
                    start: batch_starts[i],
                    count: batch_counts[i],
                });
            }
        }
    }

    pub fn render_frame(
        &mut self,
        camera_x: f32,
        camera_y: f32,
        camera_scale: f32,
        viewport_width: f32,
        viewport_height: f32,
    ) -> bool {
        if self.device_failed.load(Ordering::Relaxed) { return false; }
        let cam = CameraUniform {
            camera_x,
            camera_y,
            camera_scale,
            _pad0: 0.0,
            viewport_width: viewport_width.max(1.0),
            viewport_height: viewport_height.max(1.0),
            _pad1: 0.0,
            _pad2: 0.0,
        };
        self.queue
            .write_buffer(&self.camera_buffer, 0, bytemuck::bytes_of(&cam));

        let output = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Outdated | wgpu::SurfaceError::Lost) => {
                self.surface.configure(&self.device, &self.config);
                match self.surface.get_current_texture() {
                    Ok(frame) => frame,
                    Err(_) => return false,
                }
            }
            Err(_) => return false,
        };

        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("agora-render-encoder"),
            });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("agora-sprite-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            if !self.cached_batches.is_empty() {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.camera_bind_group, &[]);
                pass.set_vertex_buffer(0, self.instance_buffer.slice(..));
                for batch in &self.cached_batches {
                    if let Some(tex) = self.textures.get(&batch.tex_id) {
                        pass.set_bind_group(1, &tex.bind_group, &[]);
                        pass.draw(0..6, batch.start..(batch.start + batch.count));
                    }
                }
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        true
    }

    pub fn destroy(&mut self) {
        for (_, entry) in self.textures.drain() {
            entry.texture.destroy();
        }
        self.instance_buffer.destroy();
        self.camera_buffer.destroy();
    }
}
