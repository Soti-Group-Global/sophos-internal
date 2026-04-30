const EarlyDetectionInstrumentalAnalysis = require("../models/EarlyDetectionInstrumentalAnalysis");

exports.createEarlyDetectionInstrumentalAnalysis = async (req, res) => {
  try {
    const { name } = req.body;
    const newAnalysis = new EarlyDetectionInstrumentalAnalysis({ name });
    await newAnalysis.save();
    res.status(201).json(newAnalysis);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to create early detection instrumental analysis",
      });
  }
};

exports.getEarlyDetectionInstrumentalAnalyses = async (req, res) => {
  try {
    const analyses = await EarlyDetectionInstrumentalAnalysis.find();
    res.status(200).json(analyses);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to retrieve early detection instrumental analyses",
      });
  }
};

exports.getEarlyDetectionInstrumentalAnalysisById = async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await EarlyDetectionInstrumentalAnalysis.findById(id);
    if (!analysis) {
      return res
        .status(404)
        .json({ error: "Early detection instrumental analysis not found" });
    }
    res.status(200).json(analysis);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to retrieve early detection instrumental analysis",
      });
  }
};

exports.updateEarlyDetectionInstrumentalAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedAnalysis =
      await EarlyDetectionInstrumentalAnalysis.findByIdAndUpdate(
        id,
        { name },
        { new: true },
      );
    if (!updatedAnalysis) {
      return res
        .status(404)
        .json({ error: "Early detection instrumental analysis not found" });
    }
    res.status(200).json(updatedAnalysis);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to update early detection instrumental analysis",
      });
  }
};

exports.deleteEarlyDetectionInstrumentalAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAnalysis =
      await EarlyDetectionInstrumentalAnalysis.findByIdAndDelete(id);
    if (!deletedAnalysis) {
      return res
        .status(404)
        .json({ error: "Early detection instrumental analysis not found" });
    }
    res
      .status(200)
      .json({
        message: "Early detection instrumental analysis deleted successfully",
      });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to delete early detection instrumental analysis",
      });
  }
};
