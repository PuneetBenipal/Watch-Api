const Company = require("../models/Company.model")

exports.getCompany = async (req, res) => {
    try {
        const { companyId } = req.user;
        const company = await Company.findOne(
            { _id: companyId },
            { logoUrl: false, planStatus: false  }
        );

        res.json({ state: "success", data: company });
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}