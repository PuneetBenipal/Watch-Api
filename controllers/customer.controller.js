const Customer = require("../models/customer");

exports.get = async (req, res) => {
    try {
        const { companyId } = req.query;
        let customers = await Customer.find({ employer: companyId }).sort({ createdAt: -1 });

        res.json({ state: 'success', data: customers });

    } catch (error) {
        console.log("error.message", error.message)
        res.json({ state: "error", msg: error.message })
    }
}

exports.add = async (req, res) => {
    try {
        const customerData = req.body;
        customerData.employer = req.user._id;

        const newCustomer = new Customer(customerData);
        let savedCustomer = await newCustomer.save();

        res.json({ state: 'success', data: savedCustomer });
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}

exports.change = async (req, res) => {
    try {
        const data = req.body;
        const customerId = req.params.id;

        await Customer.findOneAndUpdate({ _id: customerId, employer: req.user._id }, data);

        res.json({ state: 'success', msg: 'Updated successfully' })
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        await Customer.deleteOne({ _id: id, employer: req.user._id });

        res.json({ state: 'success', msg: 'Deleted successfully' });
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}
