/**
 * 生成 iris-linker 插件图标 PNG
 * 使用 @resvg/resvg-js 将 SVG 精确渲染为 128×128 PNG
 * 设计：深蓝圆角背景 + IRIS 菱形晶体（四色分面）+ 底部白色 IRIS 文字
 */
const fs = require('fs');
const path = require('path');
// 直接加载原生 binding（绕过包解析层）
const { Resvg } = require('C:/Users/wangh/.workbuddy/node_modules/node_modules/@resvg/resvg-js-win32-x64-msvc/resvgjs.win32-x64-msvc.node');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <!-- 圆角矩形背景裁剪 -->
    <clipPath id="bg-clip">
      <rect width="128" height="128" rx="22" ry="22"/>
    </clipPath>
    <!-- 背景渐变（深海蓝到稍亮蓝） -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A3357"/>
      <stop offset="100%" stop-color="#0E2040"/>
    </linearGradient>
    <!-- 菱形四个面渐变 -->
    <linearGradient id="topLeft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4A8ED4"/>
      <stop offset="100%" stop-color="#2E6BB5"/>
    </linearGradient>
    <linearGradient id="topRight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7AB8FF"/>
      <stop offset="100%" stop-color="#4A9AEE"/>
    </linearGradient>
    <linearGradient id="bottomLeft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1C4882"/>
      <stop offset="100%" stop-color="#132E55"/>
    </linearGradient>
    <linearGradient id="bottomRight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3470CC"/>
      <stop offset="100%" stop-color="#2055A0"/>
    </linearGradient>
    <!-- 高光遮罩 -->
    <radialGradient id="shine" cx="40%" cy="30%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 背景 -->
  <g clip-path="url(#bg-clip)">
    <rect width="128" height="128" fill="url(#bgGrad)"/>

    <!-- IRIS 菱形晶体
         顶点: top(64,14)  右(102,52)  底(64,90)  左(26,52)
         中心: (64,52)
    -->

    <!-- 左上面（top→left→center）: 中蓝 -->
    <polygon points="64,14 26,52 64,52" fill="#3878C8" opacity="0.95"/>
    <!-- 右上面（top→center→right）: 亮蓝高光 -->
    <polygon points="64,14 64,52 102,52" fill="#6AABFF" opacity="0.95"/>
    <!-- 左下面（left→bottom→center）: 深蓝 -->
    <polygon points="26,52 64,90 64,52" fill="#1C4A8A" opacity="0.95"/>
    <!-- 右下面（center→bottom→right）: 中深蓝 -->
    <polygon points="64,52 64,90 102,52" fill="#2E68C4" opacity="0.95"/>

    <!-- 菱形轮廓 -->
    <polygon points="64,14 102,52 64,90 26,52"
             fill="none"
             stroke="#8EC4FF" stroke-width="1.5"
             stroke-linejoin="round"/>

    <!-- 中间水平分割线 -->
    <line x1="26" y1="52" x2="102" y2="52"
          stroke="#B8D8FF" stroke-width="0.8" opacity="0.5"/>
    <!-- 中间垂直分割线 -->
    <line x1="64" y1="14" x2="64" y2="90"
          stroke="#B8D8FF" stroke-width="0.8" opacity="0.3"/>

    <!-- 顶部高光三角（左上边缘发光感） -->
    <polygon points="64,14 26,52 64,52"
             fill="white" opacity="0.07"/>

    <!-- 整体高光遮罩（径向，左上方向） -->
    <rect width="128" height="128" fill="url(#shine)"/>

    <!-- 底部链接弧线 + 端点 -->
    <!-- 贝塞尔曲线，两端圆点 -->
    <path d="M 28 106 Q 64 94 100 106"
          fill="none"
          stroke="#6AABFF" stroke-width="2.2"
          stroke-linecap="round"/>
    <!-- 左端点 -->
    <circle cx="28" cy="106" r="4.5" fill="#6AABFF"/>
    <circle cx="28" cy="106" r="2.5" fill="#1A3357"/>
    <!-- 右端点 -->
    <circle cx="100" cy="106" r="4.5" fill="#6AABFF"/>
    <circle cx="100" cy="106" r="2.5" fill="#1A3357"/>

    <!-- IRIS 文字（底部居中，白色，粗体） -->
    <text x="64" y="121"
          font-family="Arial, Helvetica, sans-serif"
          font-size="11"
          font-weight="700"
          fill="white"
          text-anchor="middle"
          letter-spacing="2.5"
          opacity="0.9">IRIS</text>
  </g>
</svg>`;

// 渲染 SVG → PNG（直接传 SVG 字符串，原生 binding 只接受 string 参数）
const resvg = new Resvg(svg);
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

const outPath = path.join(__dirname, 'icon.png');
fs.writeFileSync(outPath, pngBuffer);
console.log(`Generated: ${outPath} (${pngBuffer.length} bytes)`);
console.log('Icon PNG generated successfully!');
