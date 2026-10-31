# Third-party notices

The frontend uses the following third-party rendering and collaboration libraries:

| Package | Version range | License | Upstream |
| --- | --- | --- | --- |
| `pixi.js` | `^8.21.0` | MIT | [pixijs/pixijs](https://github.com/pixijs/pixijs) |
| `@automerge/automerge` | `^3.5.0` | MIT | [automerge/automerge](https://github.com/automerge/automerge) |
| `mathjax` | `^4.1.3` | Apache-2.0 | [mathjax/MathJax](https://github.com/mathjax/MathJax) |

The corresponding license texts are included in the npm packages. The production build copies the PixiJS and Automerge license texts to `dist/licenses/` and the MathJax package (including its `LICENSE`) to `dist/mathjax/`.

## Complete production npm inventory

Every production build emits `/licenses/npm-inventory.json` from installed production entries in `package-lock.json`. This includes transitive dependencies and can include Node-only or optional packages not present in browser bundles. Each available upstream LICENSE/NOTICE is copied to `/licenses/npm/`, including Monaco's `ThirdPartyNotices.txt`. This project's MIT license and this document are included as well. Package/version directories remain available when older JavaScript chunks are retained across deployments.

Additional direct packages include React/React DOM, Monaco Editor, perfect-freehand, rbush and liquid-ripple (MIT), and PDF.js (Apache-2.0). PDF.js font, ICC and WebAssembly licenses are preserved inside `/pdfjs/standard_fonts/`, `/pdfjs/iccs/` and `/pdfjs/wasm/`; do not delete those files when publishing assets.

`@pixi/colord` omits a license file from its npm archive; the pinned upstream text and provenance are retained in `licenses/upstream/`. The MathJax font package declares Apache-2.0 but omits a standalone license file, so the MathJax Apache text is supplied. Native `@napi-rs/canvas` platform package notices use the parent package's MIT text. These supplements do not establish that every embedded upstream font/native component has been audited: review font/native binary provenance separately before distributing those binaries.

Third-party components retain their own licenses; this repository's MIT license does not relicense them. External Google Fonts requests and user-uploaded images/content are outside the npm inventory.

Authenticator enrollment uses `qrcode` (MIT) to create QR images locally. Its exact version, transitive dependencies and license files are included in the generated npm inventory. Enrollment secrets are not sent to a third-party QR service.
