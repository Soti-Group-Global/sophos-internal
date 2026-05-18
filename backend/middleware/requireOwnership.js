/**
 * requireOwnership — IDOR protection middleware.
 *
 * Verifies that the authenticated user owns the resource being mutated,
 * OR that they have an elevated role that is allowed to mutate any record.
 *
 * Usage:
 *   router.put('/:id', auth, requireOwnership({
 *     model: Doctor,
 *     idParam: 'id',                        // req.params key (default: 'id')
 *     ownerField: 'email',                  // field on the model that identifies the owner
 *     userField: 'email',                   // field on req.user to compare against
 *     allowedRoles: ['manager','super_admin'], // roles that bypass the check
 *   }), updateDoctor);
 */

const requireOwnership = ({
  model,
  idParam = 'id',
  ownerField = 'email',
  userField = 'email',
  allowedRoles = ['manager', 'head_manager', 'super_admin'],
}) => async (req, res, next) => {
  try {
    // Elevated roles bypass ownership check
    if (allowedRoles.includes(req.user?.role)) return next();

    const resourceId = req.params[idParam];
    const resource = await model.findById(resourceId).lean();

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const ownerValue = resource[ownerField];
    const userValue  = req.user?.[userField];

    if (!ownerValue || !userValue || String(ownerValue) !== String(userValue)) {
      return res.status(403).json({ message: 'Access denied: you do not own this resource' });
    }

    next();
  } catch (err) {
    console.error('requireOwnership error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = requireOwnership;
