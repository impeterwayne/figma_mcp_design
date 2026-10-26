# Figma MCP Design

*[English](README.md) · **Tiếng Việt***

MCP server viết bằng Go, giao tiếp qua stdio, giúp các AI client đọc và chỉnh sửa trực tiếp file Figma đang mở thông qua một plugin chạy ngay trên máy — không cần Figma API token và không bị giới hạn rate limit. Server hỗ trợ đầy đủ cả đọc lẫn ghi (read/write): phân tích thiết kế, tạo và chỉnh sửa node, auto-layout, quản lý style, variable (design token), component, prototype, xuất ảnh và PDF nhiều trang, đi kèm bộ AI Agent Skills chuyên cho thiết kế.

Repo gồm ba phần hoạt động cùng nhau:

- MCP server cung cấp 86 tool và 18 prompt thiết kế qua stdio
- plugin Figma Desktop kết nối tới server tại `ws://127.0.0.1:1995` (mặc định)
- bộ kỹ năng cho AI agent (`.agents/skills/`) phục vụ thiết kế UI/UX, design system, nhận diện thương hiệu, banner, slide và quy trình làm việc trên Figma

## Features

- Cho phép AI client đọc và chỉnh sửa trực tiếp (full read/write) file Figma đang mở
- Không cần Figma REST API key, không giới hạn số lần gọi
- Plugin kết nối nội bộ qua WebSocket (`ws://127.0.0.1:1995`), hỗ trợ nhiều AI client chạy song song qua cơ chế Leader/Follower
- 86 tool để duyệt tài liệu, tạo mới, chỉnh sửa bố cục & thuộc tính, quản lý style, variable, component, page, prototype và xuất file
- 18 MCP prompt tích hợp sẵn cho chiến lược thiết kế, chuẩn đặt tên token, kiểm tra trợ năng (WCAG) và tái cấu trúc design system
- Xuất design token ra JSON hoặc CSS custom properties
- Chụp ảnh màn hình node (lưu thẳng ra file) và xuất nhiều frame thành một file PDF nhiều trang
- Tích hợp bộ AI agent skills (`figma-design-workflow`, `ui-ux-pro-max`, `design-system`, `ui-styling`, `brand`, `design`, `banner-design`, `slides`)
- Server Go kèm gói npm đa nền tảng để MCP client chạy trực tiếp qua `npx`

## Yêu cầu

- Node.js `>=18`
- Figma Desktop
- Go `1.26.1+` nếu muốn phát triển server
- Bun nếu muốn phát triển plugin

## Cài đặt

### 1. Cấu hình AI client

#### Claude Code / Claude Desktop / VS Code / Cursor / Antigravity

Nội dung khai báo giống hệt nhau, chỉ khác chỗ đặt file:

- Claude Code — `.mcp.json` ở thư mục gốc của project
- Claude Desktop — `claude_desktop_config.json`
- Cursor — `.cursor/mcp.json`
- VS Code — `.vscode/mcp.json` (VS Code dùng key ngoài cùng là `servers` chứ không phải `mcpServers`)
- Antigravity — mở bảng cài đặt MCP (MCP Store -> **View raw config**), tương ứng file `~/.gemini/config/mcp_config.json`, hoặc `.agents/mcp_config.json` nếu chỉ muốn áp dụng cho một workspace

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "npx",
      "args": ["-y", "@impeterwayne/figma_mcp_design@latest"]
    }
  }
}
```

#### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.figma_mcp_design]
command = "npx"
args = ["-y", "@impeterwayne/figma_mcp_design@latest"]
```

#### OpenCode
`opencode.json`
```json
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "figma_mcp_design": {
            "type": "local",
            "command": [
                "npx",
                "-y",
                "@impeterwayne/figma_mcp_design@latest"
            ],
            "enabled": true
        }
    }
}
```

### 2. Cài plugin vào Figma Desktop

Không có plugin thì server không giao tiếp được với Figma, nên bước này là bắt buộc.

1. Tải `figma_design_plugin.zip` mới nhất ở trang [releases](https://github.com/impeterwayne/figma_mcp_design/releases).
2. Giải nén ra một thư mục bất kỳ trên máy.
3. Mở Figma Desktop.
4. Chọn **Plugins** -> **Development** -> **Import plugin from manifest...**.
5. Trỏ tới file `manifest.json` trong thư mục vừa giải nén.
6. Mở file thiết kế cần làm việc rồi chạy plugin.
7. Mở AI client và bắt đầu gọi các tool của `figma_mcp_design`.

### 3. Cài đặt bộ Agent Skills (tùy chọn)

1. Tải `figma_design_skills.zip` ở trang [releases](https://github.com/impeterwayne/figma_mcp_design/releases) (hoặc chép thư mục `.agents/skills/` trong repo này).
2. Giải nén vào thư mục `.agents/skills/` của project để trang bị thêm cho AI các quy trình dựng thiết kế Figma chuẩn auto-layout, tra cứu UI/UX, kiến trúc design token, bộ nhận diện thương hiệu, thiết kế banner và thuyết trình HTML.

## Profile tool

Mô tả của mọi tool được nạp vào ngữ cảnh của AI ở mỗi phiên. Dùng `--profile` để chỉ nạp bộ tool cần thiết:

| Profile | Số tool | Dung lượng schema | Dùng khi |
|---------|---------|-------------------|----------|
| `full` (mặc định) | 86 | ~66 KB | Mọi việc, kể cả prototype, xuất PDF, đổi tên hàng loạt |
| `design` | 63 | ~50 KB | Dựng và chỉnh UI, design system, component |
| `read` | 22 | ~14 KB | Đọc, review, xuất ảnh; không có tool ghi |

```json
"args": ["--profile", "design"]
```

## Danh sách tool

86 tool — gồm 21 tool đọc/xuất dữ liệu và 65 tool tạo mới/chỉnh sửa trực tiếp trên tài liệu Figma.

### Duyệt documents và node

| Tool | Chức năng |
|------|-----------|
| `get_design_context` | Trả về cây node rút gọn theo độ sâu, hỗ trợ gộp component trùng lặp để tiết kiệm token. **Nên dùng đầu tiên** khi file lớn. |
| `get_document` | Toàn bộ cây node của *page hiện tại* (không phải cả file). Đệ quy nên kết quả có thể rất lớn. |
| `get_pages` | Liệt kê các page kèm ID và tên — nhẹ hơn nhiều so với `get_document`. |
| `get_metadata` | Tên file, danh sách page và page đang mở. |
| `get_selection` | Các node đang chọn trong Figma; không chọn gì thì trả về mảng rỗng. |
| `get_node` | Lấy một node theo ID. ID viết theo dạng dấu hai chấm (`4029:12345`), không phải dấu gạch ngang. |
| `get_nodes_info` | Lấy nhiều node cùng lúc — nên dùng thay vì gọi `get_node` nhiều lần. |
| `search_nodes` | Tìm node theo một phần tên và/hoặc theo type, trong phạm vi một node cha. |
| `scan_nodes_by_types` | Lấy tất cả node thuộc những type chỉ định, bất kể tên là gì. |
| `scan_text_nodes` | Lấy toàn bộ nội dung chữ trong các node TEXT. |
| `get_reactions` | Các reaction prototype gắn trên node — trigger và danh sách action. |
| `get_viewport` | Vị trí khung nhìn hiện tại: tâm màn hình, mức zoom và vùng đang thấy. |
| `get_fonts` | Các font đang dùng trong page, sắp xếp theo mức độ sử dụng. |

### Style, variable, component, annotation, token

| Tool | Chức năng |
|------|-----------|
| `get_styles` | Các style paint, text, effect và grid trong file, kèm ID và thuộc tính. |
| `get_variable_defs` | Các variable trong file — collection, mode và giá trị (design token của Figma). |
| `get_local_components` | Các component và component set được định nghĩa trong file hiện tại. |
| `get_annotations` | Annotation ở chế độ dev, lấy toàn page hoặc chỉ một node. |
| `export_tokens` | Xuất variable và paint style ra JSON hoặc CSS custom property. |

### Xuất file

| Tool | Chức năng |
|------|-----------|
| `get_screenshot` | Chụp node và trả về ảnh dạng base64 trong bộ nhớ (`PNG`, `SVG`, `JPG`, `PDF`). |
| `save_screenshots` | Chụp node và lưu thẳng thành file, trả về đường dẫn, dung lượng, kích thước — không kèm base64. |
| `export_frames_to_pdf` | Xuất nhiều frame theo thứ tự và ghép thành một file PDF nhiều trang duy nhất trên ổ cứng. |

### Tạo mới node

| Tool | Chức năng |
|------|-----------|
| `create_frame` | Tạo frame mới trên page hoặc bên trong một node cha, hỗ trợ cấu hình sẵn auto-layout và màu nền. |
| `create_section` | Tạo Section trên page hiện tại để gom nhóm và tổ chức các frame. |
| `create_rectangle` | Tạo hình chữ nhật kèm màu nền và bo góc tùy chọn. |
| `create_ellipse` | Tạo hình elip hoặc hình tròn kèm màu nền tùy chọn. |
| `create_text` | Tạo node văn bản, tự động nạp font family và font style trước khi chèn. |
| `import_image` | Chèn ảnh PNG/JPG dạng base64 vào Figma dưới dạng node có image fill. |
| `create_instance` | Tạo instance của một component (hoặc variant mặc định của component set) bên trong một parent, có thể đặt luôn các thuộc tính. |
| `create_component` | Chuyển đổi một node FRAME có sẵn thành COMPONENT tái sử dụng ngay tại vị trí đó. |

### Chỉnh sửa node và bố cục (Layout)

| Tool | Chức năng |
|------|-----------|
| `set_text` | Cập nhật nội dung chữ của một node TEXT, hoặc của nhiều node trong một lần gọi qua `items`. |
| `set_text_properties` | Chỉnh typography cho một hoặc nhiều node TEXT: font, cỡ chữ, line height, letter spacing, căn lề, kiểu chữ hoa/thường, gạch chân, auto-resize. |
| `set_image_fill` | Gắn ảnh base64 làm fill cho một hoặc nhiều node có sẵn (`FILL`, `FIT`, `CROP`, `TILE`). |
| `find_replace_text` | Tìm và thay thế văn bản (chuỗi thường hoặc regex) trên toàn bộ node TEXT trong một nhánh hoặc cả page. |
| `set_fills` | Đặt mới hoặc chồng thêm (append) màu nền (`#RRGGBB` / `#RRGGBBAA`) và độ mờ cho một node. |
| `set_strokes` | Đặt mới hoặc chồng thêm màu viền và độ dày viền cho một node. |
| `set_opacity` | Chỉnh độ trong suốt (`0` đến `1`) cho một hoặc nhiều node. |
| `set_corner_radius` | Chỉnh bo góc đồng nhất hoặc riêng từng góc cho một hoặc nhiều node. |
| `set_auto_layout` | Bật hoặc cập nhật thuộc tính auto-layout (hướng, padding, khoảng cách, căn chỉnh, hug/fixed, xuống dòng) cho frame. |
| `set_constraints` | Thiết lập ràng buộc co giãn/neo vị trí (constraints) theo chiều ngang và dọc so với node cha. |
| `set_blend_mode` | Đổi chế độ hòa trộn (blend mode như `MULTIPLY`, `SCREEN`, `OVERLAY`) cho một hoặc nhiều node. |
| `set_visible` | Ẩn hoặc hiện một hoặc nhiều node. |
| `move_nodes` | Di chuyển một hoặc nhiều node tới tọa độ `x`/`y` tuyệt đối. |
| `resize_nodes` | Thay đổi kích thước `width` và/hoặc `height` của một hoặc nhiều node. |
| `rotate_nodes` | Xoay một hoặc nhiều node theo góc độ tuyệt đối. |
| `reorder_nodes` | Thay đổi thứ tự lớp (`bringToFront`, `sendToBack`, `bringForward`, `sendBackward`). |
| `reparent_nodes` | Di chuyển một hoặc nhiều node sang một frame, group hoặc section cha khác. |
| `rename_node` | Đổi tên một node theo ID. |
| `batch_rename_nodes` | Đổi tên hàng loạt node bằng tìm/thay thế, regex, hoặc thêm tiền tố/hậu tố. |
| `clone_node` | Nhân bản một node có sẵn, cho phép đặt lại tọa độ hoặc chuyển sang node cha mới. |
| `lock_nodes` | Khóa một hoặc nhiều node để tránh thao tác chỉnh sửa nhầm. |
| `unlock_nodes` | Mở khóa cho một hoặc nhiều node. |
| `delete_nodes` | Xóa vĩnh viễn một hoặc nhiều node khỏi tài liệu. |

### Quản lý style và hiệu ứng (Effects)

| Tool | Chức năng |
|------|-----------|
| `create_paint_style` | Tạo paint style màu đơn sắc mới trong file. |
| `create_text_style` | Tạo text style mới (font, kiểu chữ, cỡ chữ, chiều cao dòng, khoảng cách chữ). |
| `create_effect_style` | Tạo effect style mới (đổ bóng ngoài, bóng trong, làm mờ lớp hoặc làm mờ nền). |
| `create_grid_style` | Tạo layout grid style mới (`GRID`, `COLUMNS`, hoặc `ROWS`). |
| `update_paint_style` | Cập nhật tên, màu sắc hoặc mô tả của một paint style có sẵn. |
| `rename_style` | Đổi tên bất kỳ style nào (paint, text, effect, grid) mà vẫn giữ nguyên liên kết với các node. |
| `delete_style` | Xóa một style theo ID. |
| `apply_style_to_node` | Gắn một style (paint, text, effect, grid) có sẵn vào node. |
| `set_effects` | Áp dụng trực tiếp danh sách hiệu ứng (shadow, blur) lên một node. |
| `replace_colors` | Đổi màu cả cây node trong một lần gọi: ánh xạ mã hex (fill, stroke, điểm gradient, shadow, màu theo đoạn chữ) sang variable hoặc mã hex mới. `dryRun` liệt kê màu đang dùng; `nodeTypes` giới hạn loại lớp, ví dụ TEXT. |
| `snap_to_tokens` | Gắn padding/gap auto-layout và bo góc trong cây node vào variable spacing/radius gần nhất (dạng viên thuốc dùng radius full). `dryRun` báo các giá trị sẽ đổi. |
| `bind_variable_to_node` | Liên kết một variable (`COLOR`, `FLOAT`, `BOOLEAN`) vào thuộc tính của node (màu, khoảng cách, bo góc, kích thước...). |
| `set_description` | Đặt hoặc xóa nội dung mô tả (description) trên component, component set, style hoặc variable. |

### Quản lý variable và collection

| Tool | Chức năng |
|------|-----------|
| `create_variable_collection` | Tạo variable collection mới kèm tên mode khởi tạo tùy chọn. |
| `rename_variable_collection` | Đổi tên một variable collection. |
| `add_variable_mode` | Thêm mode mới (ví dụ `Light`/`Dark`) vào variable collection. |
| `rename_mode` | Đổi tên một mode trong variable collection. |
| `create_variable` | Tạo variable mới (`COLOR`, `FLOAT`, `STRING`, `BOOLEAN`) trong một collection. |
| `set_variable_value` | Đặt giá trị cho variable ứng với một mode cụ thể. |
| `rename_variable` | Đổi tên variable mà vẫn bảo toàn mọi liên kết trên node. |
| `batch_rename_variables` | Đổi tên tối đa 100 variable chỉ trong một lần gọi. |
| `delete_variable` | Xóa một variable đơn lẻ hoặc xóa toàn bộ variable collection. |

### Component, group và page

| Tool | Chức năng |
|------|-----------|
| `group_nodes` | Gom hai hoặc nhiều node cùng cấp thành một `GROUP`. |
| `ungroup_nodes` | Rã nhóm một hoặc nhiều `GROUP`, đưa các node con ra ngoài node cha. |
| `swap_component` | Hoán đổi component gốc của một `INSTANCE` sang component khác mà vẫn giữ nguyên vị trí và kích thước. |
| `set_instance_properties` | Đặt thuộc tính variant, boolean và text cho instance theo tên hiển thị (ví dụ `Size`, `Label`). |
| `detach_instance` | Tách một hoặc nhiều component instance thành frame thường. |
| `navigate_to_page` | Chuyển sang page khác trong file theo `pageId` hoặc `pageName`. |
| `add_page` | Thêm page mới vào tài liệu Figma tại vị trí tùy chọn. |
| `rename_page` | Đổi tên một page hiện có theo ID hoặc tên cũ. |
| `delete_page` | Xóa một page khỏi tài liệu (miễn là tài liệu còn ít nhất một page). |

### Prototype và tương tác

| Tool | Chức năng |
|------|-----------|
| `set_reactions` | Thiết lập hoặc nối thêm các reaction prototype (sự kiện kích hoạt, điều hướng, hiệu ứng chuyển cảnh) trên node. |
| `remove_reactions` | Xóa toàn bộ hoặc xóa từng reaction prototype theo chỉ mục trên một node. |
| `set_connector_endpoints` | Trỏ lại điểm đầu và/hoặc điểm cuối của một connector (mũi tên flow) sang node khác. |

## Giấy phép

MIT. Xem [LICENSE](LICENSE).
