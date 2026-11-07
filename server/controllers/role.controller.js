import Role from "../models/role.model.js";

export const getAssignableRoles = async (req, res, next) => {
  try {
    const currentRole = req.user.role;

    const isSuperAdmin = currentRole?.permissions?.includes("*");

    const filter = {
      isActive: true,
    };

    // Users can only assign roles below their own level.
    if (!isSuperAdmin) {
      filter.level = { $lt: currentRole.level };
    }

    const roles = await Role.find(filter)
      .select("_id name slug level description permissions scope")
      .sort({ level: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Assignable roles retrieved successfully.",
      data: { roles },
    });
  } catch (error) {
    next(error);
  }
};
