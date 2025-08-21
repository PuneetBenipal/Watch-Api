const User = require("../models/User.model");

exports.get = async (req, res) => {
    try {
        const { employer } = req.query;
        let agents = await User.find({ employer: employer });

        res.json({ state: 'success', data: agents });

    } catch (error) {
        console.log("error.message", error.message)
        res.json({ state: "error", msg: error.message })
    }
}

exports.add = async (req, res) => {
    try {
        const { email, name, employer } = req.body;

        let existsUser = await User.findOne({ email: email })

        if (existsUser) return res.json({ state: "warning", msg: "User is already exists." })

        const newAgent = new User({
            email: email,
            name: name,
            employer: employer
        })

        let savedAgent = await newAgent.save();

        res.json({ state: 'success', data: savedAgent });
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}

exports.change = async (req, res) => {
    try {
        const data = req.body;
        const userId = req.params.id;
        console.log('data', data)
        await User.findOneAndUpdate({ _id: userId }, data);

        res.json({ state: 'success', msg: 'Updated successfully' })
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        await User.deleteOne({ _id: id });

        res.json({ state: 'success', msg: 'Deleted successfully' });
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}
