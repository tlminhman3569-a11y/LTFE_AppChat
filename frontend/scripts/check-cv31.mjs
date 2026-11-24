import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// Chỉ dùng dữ liệu mẫu trong trình duyệt, không đăng nhập/gửi lên máy chủ.
const root = fileURLToPath(new URL('..', import.meta.url))
const browser = process.env.CV31_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const bundle = await build({ root, configFile: false, plugins: [react()], logLevel: 'error',
    build: { write: false, rollupOptions: { input: resolve(root, 'scripts/cv31-browser-probe.tsx') } } })
const javascript = bundle.output.filter(asset => asset.type === 'chunk').map(chunk => chunk.code).join('\n')
const css = bundle.output.filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    .map(asset => asset.source).join('\n')
const directory = mkdtempSync(join(process.env.CV31_OUTPUT ?? tmpdir(), 'cv31-browser-'))
const page = join(directory, 'index.html')
const inner = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css
    + '</style><div id="root"></div><script type="module">' + javascript + '</script>'
writeFileSync(page, '<meta charset="utf-8"><style>body{margin:0}iframe{border:0;width:1280px;height:900px}</style>'
    + '<iframe srcdoc="' + inner.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '"></iframe>')

let result = ''
let browserError = ''
for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const run = spawnSync(browser, ['--headless=new', '--no-first-run', '--disable-gpu', '--window-size=1280,1000',
        '--user-data-dir=' + join(directory, 'profile-' + attempt), '--dump-dom',
        '--virtual-time-budget=15000', pathToFileURL(page).href],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 5_000_000, windowsHide: true })
    writeFileSync(join(directory, 'last-output.html'), run.stdout ?? '')
    browserError = run.error?.message ?? ('Exit ' + run.status + ': ' + (run.stderr?.slice(-1500) ?? ''))
    result = run.stdout?.match(/<pre id="cv31-result">([^<]+)/)?.[1] ?? ''
}
// Giữ HTML ở thư mục tạm để xem lại khi một ca không đạt.
if (!result) throw new Error('Không nhận được kết quả trình duyệt. ' + browserError + '\nTrang kiểm tra: ' + page)
console.log(result)
console.log('Trang kiểm tra: ' + page)
process.exitCode = result.startsWith('PASS') ? 0 : 1
