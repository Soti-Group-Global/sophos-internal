const EarlyDetectionLaboratoryTest = require("../models/EarlyDetectionLaboratoryTest");

exports.createEarlyDetectionLaboratoryTest = async (req, res) => {
  try {
    const { name } = req.body;
    const newTest = new EarlyDetectionLaboratoryTest({ name });
    await newTest.save();
    res.status(201).json(newTest);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create early detection laboratory test" });
  }
};

exports.getEarlyDetectionLaboratoryTests = async (req, res) => {
  try {
    const tests = await EarlyDetectionLaboratoryTest.find();
    res.status(200).json(tests);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to retrieve early detection laboratory tests" });
  }
};

exports.getEarlyDetectionLaboratoryTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await EarlyDetectionLaboratoryTest.findById(id);
    if (!test) {
      return res
        .status(404)
        .json({ error: "Early detection laboratory test not found" });
    }
    res.status(200).json(test);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to retrieve early detection laboratory test" });
  }
};

exports.updateEarlyDetectionLaboratoryTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedTest = await EarlyDetectionLaboratoryTest.findByIdAndUpdate(
      id,
      { name },
      { new: true },
    );
    if (!updatedTest) {
      return res
        .status(404)
        .json({ error: "Early detection laboratory test not found" });
    }
    res.status(200).json(updatedTest);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update early detection laboratory test" });
  }
};

exports.deleteEarlyDetectionLaboratoryTest = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTest =
      await EarlyDetectionLaboratoryTest.findByIdAndDelete(id);
    if (!deletedTest) {
      return res
        .status(404)
        .json({ error: "Early detection laboratory test not found" });
    }
    res
      .status(200)
      .json({
        message: "Early detection laboratory test deleted successfully",
      });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete early detection laboratory test" });
  }
};
