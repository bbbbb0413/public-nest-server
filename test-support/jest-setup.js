const bufferModule = require('buffer');
bufferModule.SlowBuffer = bufferModule.Buffer;

// MySQL 8 + mysql2 cesu8 인코딩 호환 패치
const iconvLite = require('iconv-lite');
if (!iconvLite.encodingExists('cesu8')) {
  iconvLite.encodings['cesu8'] = iconvLite.encodings['utf8'];
}
