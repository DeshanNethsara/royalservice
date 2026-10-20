import Service from '../models/Service.js';

export const getActiveServices = async (req, res) => {
  try {
    const services = await Service.find({ is_active: true }).sort({ created_at: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllServices = async (req, res) => {
  try {
    const services = await Service.find().populate('staff_id', 'name email').sort({ created_at: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createService = async (req, res) => {
  const { name, price, description, duration_minutes, staff_id } = req.body;
  try {
    const service = await Service.create({
      name,
      price,
      description,
      duration_minutes,
      staff_id: staff_id || null,
    });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateService = async (req, res) => {
  const { name, price, description, duration_minutes, is_active, staff_id } = req.body;
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    service.name = name || service.name;
    service.price = price || service.price;
    service.description = description !== undefined ? description : service.description;
    service.duration_minutes = duration_minutes || service.duration_minutes;
    if (is_active !== undefined) service.is_active = is_active;
    if (staff_id !== undefined) service.staff_id = staff_id;

    const updatedService = await service.save();
    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================================
// NEW: Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
// ==========================================================
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: error.message });
  }
};