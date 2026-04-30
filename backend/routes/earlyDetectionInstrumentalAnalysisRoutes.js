const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const EarlyDetectionInstrumentalAnalysisController = require('../controllers/EarlyDetectionInstrumentalAnalysisController');    

router.post('/', EarlyDetectionInstrumentalAnalysisController.createEarlyDetectionInstrumentalAnalysis);
router.get('/', EarlyDetectionInstrumentalAnalysisController.getEarlyDetectionInstrumentalAnalyses);
router.get('/:id', EarlyDetectionInstrumentalAnalysisController.getEarlyDetectionInstrumentalAnalysisById);
router.put('/:id', EarlyDetectionInstrumentalAnalysisController.updateEarlyDetectionInstrumentalAnalysis);
router.delete('/:id', EarlyDetectionInstrumentalAnalysisController.deleteEarlyDetectionInstrumentalAnalysis);   

module.exports = router;