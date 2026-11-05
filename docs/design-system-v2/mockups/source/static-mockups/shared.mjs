export function thumb(kind, seed) {
  const pals = [['#1b2a49', '#5b3a6e', '#e07a5f'], ['#0f2027', '#203a43', '#2c7a7b'], ['#2b1d0e', '#6b3e1f', '#f5b93d'], ['#141e30', '#243b55', '#7aa2c9']];
  const [a, b, c] = pals[seed % pals.length];
  const fps = `
    <polygon points="0,250 220,190 420,230 640,170 800,210 800,450 0,450" fill="${b}" opacity=".9"/>
    <polygon points="0,320 300,270 560,300 800,260 800,450 0,450" fill="#000" opacity=".35"/>
    <rect x="470" y="150" width="90" height="140" fill="#000" opacity=".25"/><rect x="560" y="120" width="60" height="170" fill="#000" opacity=".18"/>
    <rect x="120" y="200" width="70" height="90" fill="#000" opacity=".2"/>
    <g stroke="#fff" stroke-width="3" opacity=".9"><line x1="400" y1="205" x2="400" y2="217"/><line x1="400" y1="233" x2="400" y2="245"/><line x1="380" y1="225" x2="392" y2="225"/><line x1="408" y1="225" x2="420" y2="225"/></g>
    <path d="M520 450 L600 330 L700 320 L760 450 Z" fill="#111" opacity=".85"/><rect x="600" y="315" width="120" height="22" rx="4" fill="#222"/>
    <rect x="20" y="20" width="110" height="110" rx="10" fill="#000" opacity=".45" stroke="#fff" stroke-opacity=".3"/><circle cx="75" cy="75" r="5" fill="#f5b93d"/><circle cx="100" cy="50" r="4" fill="#ef4444"/>
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="660" y="40" font-size="14" opacity=".85">Nova  &gt;  Rook</text><text x="660" y="62" font-size="14" opacity=".85">Nova  &gt;  Ash</text>
    <text x="30" y="318" font-size="30">100</text><text x="680" y="318" font-size="30">24<tspan font-size="18" opacity=".7"> / 90</tspan></text></g>
    <rect x="95" y="298" width="160" height="10" rx="5" fill="#fff" opacity=".25"/><rect x="95" y="298" width="130" height="10" rx="5" fill="#4ade80"/>`;
  const moba = `
    <rect width="800" height="450" fill="${b}"/><path d="M0 330 Q200 280 400 320 T800 300 L800 450 L0 450Z" fill="#000" opacity=".25"/>
    <path d="M80 450 Q300 200 800 120" stroke="#e9d8a6" stroke-opacity=".35" stroke-width="40" fill="none"/>
    <circle cx="300" cy="230" r="26" fill="${c}"/><circle cx="470" cy="180" r="22" fill="#ef4444" opacity=".9"/><circle cx="520" cy="240" r="18" fill="#ef4444" opacity=".8"/>
    <rect x="270" y="190" width="60" height="7" rx="3" fill="#000" opacity=".5"/><rect x="270" y="190" width="45" height="7" rx="3" fill="#4ade80"/>
    <rect x="640" y="250" width="140" height="140" rx="8" fill="#000" opacity=".55" stroke="#fff" stroke-opacity=".3"/><path d="M650 380 L770 260" stroke="#e9d8a6" stroke-opacity=".5" stroke-width="6"/>
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="20" y="34" font-size="18">12 / 3 / 7</text><text x="700" y="34" font-size="18">24:51</text></g>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="800" height="450" fill="url(#s)"/>${kind === 'moba' ? moba : fps}</svg>`)}`;
}
export const bannerSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 220" width="800" height="220"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151518"/><stop offset=".6" stop-color="#4A310A"/><stop offset="1" stop-color="#F5B93D"/></linearGradient></defs><rect width="800" height="220" fill="url(#b)"/><g stroke="#F5B93D" stroke-opacity=".35" fill="none" stroke-width="2"><circle cx="640" cy="60" r="80"/><circle cx="640" cy="60" r="130"/><path d="M0 170 Q260 90 800 160"/></g></svg>`)}`;
