const router = require('express').Router();
const ctrl = require('../controllers/discounts.controller');

// router.use(require('../middleware/adminAuth'));

router.get('/items', ctrl.listItems);
router.get('', ctrl.index);
router.post('', ctrl.create);
router.patch('/:id', ctrl.update);
router.post('/:id/toggle', ctrl.toggle);

module.exports = router;
