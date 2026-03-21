import https from 'https';
https.request('https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3', { method: 'HEAD' }, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
}).end();
