struct CameraUniform {
    camera_x: f32,
    camera_y: f32,
    camera_scale: f32,
    _pad0: f32,
    viewport_width: f32,
    viewport_height: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

@group(1) @binding(0)
var sprite_texture: texture_2d<f32>;
@group(1) @binding(1)
var sprite_sampler: sampler;

struct InstanceInput {
    @location(0) center: vec2<f32>,
    @location(1) offset: vec2<f32>,
    @location(2) size: vec2<f32>,
    @location(3) uv_min: vec2<f32>,
    @location(4) uv_max: vec2<f32>,
    @location(5) rotation: f32,
    @location(6) tint: u32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) tint: vec4<f32>,
};

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    instance: InstanceInput,
) -> VertexOutput {
    let ndc_scale = vec2<f32>(
        2.0 / max(1.0, camera.viewport_width),
        2.0 / max(1.0, camera.viewport_height),
    );
    let screen_center = instance.center * camera.camera_scale + vec2<f32>(camera.camera_x, camera.camera_y);
    let ndc_center = vec2<f32>(
        screen_center.x * ndc_scale.x - 1.0,
        1.0 - screen_center.y * ndc_scale.y,
    );
    let box_center = instance.offset + instance.size * 0.5;
    let half_diag = (length(box_center) + length(instance.size) * 0.5) * camera.camera_scale;
    let cull_margin = vec2<f32>(half_diag * ndc_scale.x, half_diag * ndc_scale.y);

    var out: VertexOutput;
    if (ndc_center.x + cull_margin.x < -1.0 || ndc_center.x - cull_margin.x > 1.0 ||
        ndc_center.y + cull_margin.y < -1.0 || ndc_center.y - cull_margin.y > 1.0) {
        out.clip_position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.uv = vec2<f32>(0.0, 0.0);
        out.tint = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return out;
    }

    var corner: vec2<f32>;
    switch vertex_index {
        case 0u: { corner = vec2<f32>(0.0, 0.0); }
        case 1u: { corner = vec2<f32>(1.0, 0.0); }
        case 2u: { corner = vec2<f32>(0.0, 1.0); }
        case 3u: { corner = vec2<f32>(0.0, 1.0); }
        case 4u: { corner = vec2<f32>(1.0, 0.0); }
        default: { corner = vec2<f32>(1.0, 1.0); }
    }

    let local = instance.offset + corner * instance.size;
    var rotated = local;
    if (instance.rotation != 0.0) {
        let c = cos(instance.rotation);
        let s = sin(instance.rotation);
        rotated = vec2<f32>(
            local.x * c - local.y * s,
            local.x * s + local.y * c,
        );
    }
    let screen = (instance.center + rotated) * camera.camera_scale + vec2<f32>(camera.camera_x, camera.camera_y);
    let ndc = vec2<f32>(
        screen.x * ndc_scale.x - 1.0,
        1.0 - screen.y * ndc_scale.y,
    );

    let r = f32((instance.tint >> 16u) & 0xffu) / 255.0;
    let g = f32((instance.tint >> 8u) & 0xffu) / 255.0;
    let b = f32(instance.tint & 0xffu) / 255.0;

    out.clip_position = vec4<f32>(ndc, 0.0, 1.0);
    out.uv = mix(instance.uv_min, instance.uv_max, corner);
    out.tint = vec4<f32>(r, g, b, 1.0);
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let tex = textureSample(sprite_texture, sprite_sampler, in.uv);
    return vec4<f32>(tex.rgb * in.tint.rgb, tex.a * in.tint.a);
}
