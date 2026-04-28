const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const {
  getMessagesByEmail,
  sendMessage,
  deleteMessage,
  uploadMessageFile,
  getMessageFileById,
} = require('../controllers/messagesController');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed!'), false);
    }
  }
});

router.get('/messages/:email', auth, getMessagesByEmail);
router.post('/messages', auth, sendMessage);
router.delete('/messages/:email/:messageId', auth, deleteMessage);
router.post('/messages/upload', auth, upload.single('file'), uploadMessageFile);
router.get('/file-by-id/:id', getMessageFileById);

module.exports = router;
