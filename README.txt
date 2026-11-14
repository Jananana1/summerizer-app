Excel Results Summarizer (offline)

All files must stay together in ONE folder. Do not separate them.
Open index.html (double-click) to use it right away.

TO INSTALL AS AN APP (icon on the home screen / desktop):
The app must be served over HTTPS (or localhost) for the "Install app" button to work.
Easiest way: upload this whole folder to a free static host (Netlify Drop, GitHub Pages,
Cloudflare Pages), open the link in Chrome/Edge/Safari, then press "Install app".
On iPhone/iPad: Safari > Share > Add to Home Screen.
After installing, open it from the app icon. It also works offline.
(If you change any file, bump CACHE in sw.js, e.g. summarizer-v2.)

index.html            - HTML
style.css             - styles
app.js                - Excel summarizer, text report, PDF/.txt download
reports.js            - Individual reports (Word/PDF, one file per client)
rep-core.js           - fills the template and builds the PDF
template.js           - Word template (base64)
install.js            - Install button
manifest.webmanifest, sw.js, icons/ - app install + offline support
xlsx.full.min.js, jszip.min.js, jspdf.umd.min.js, jspdf.plugin.autotable.min.js - libraries
