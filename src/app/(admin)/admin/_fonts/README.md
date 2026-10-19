# Noto Sans KR (관리자 화면 폰트)

`next/font/google`이 빌드 중 Google Fonts에서 확장자 없는 폰트 URL을 받으면 빌드가 실패하는 문제가 있어 폰트를 저장소에 둔다.

- 원본: https://github.com/google/fonts/blob/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
  - SHA-256: `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252`
  - 버전: 2.004 (upstream: https://github.com/notofonts/noto-cjk `Sans/Variable/TTF/Subset/NotoSansKR-VF.ttf`)
  - 가변 축: `wght` 100–900
- 변환: fontTools `fonttools ttLib.woff2 compress`로 TTF → WOFF2 무손실 변환(서브셋 없음)
  - `NotoSansKR-VF.woff2` SHA-256: `f484190a87503ac2af2cf9771ec35122128453fe0cd92f4368117562d99547e6`
- 라이선스: SIL Open Font License 1.1 (`OFL.txt`)
