const Router = require('express').Router();

const authenticateToken = require('../middleware/auth');
const agentCtrl = require("../controllers/agent.ctrl");
// Create checkout session
Router.get('/', authenticateToken, agentCtrl.get);
Router.post('/', authenticateToken, agentCtrl.add);
Router.put('/:id', authenticateToken, agentCtrl.change);
Router.delete('/:id', authenticateToken, agentCtrl.delete);


module.exports = Router;