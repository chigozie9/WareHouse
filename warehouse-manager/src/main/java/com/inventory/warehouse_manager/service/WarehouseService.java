package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;

    public WarehouseService(WarehouseRepository warehouseRepository) {
        this.warehouseRepository = warehouseRepository;
    }

    public List<Warehouse> getAllWarehouses() {
        return warehouseRepository.findAll();
    }

    public Warehouse getWarehouseById(Long id) {
        return warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id " + id));
    }

    public Warehouse createWarehouse(Warehouse warehouse) {
        // ensure currentCapacity starts at 0 if null or greater than max
        if (warehouse.getCurrentCapacity() == null) {
            warehouse.setCurrentCapacity(0);
        }
        if (warehouse.getCurrentCapacity() > warehouse.getMaxCapacity()) {
            warehouse.setCurrentCapacity(warehouse.getMaxCapacity());
        }
        return warehouseRepository.save(warehouse);
    }

    public Warehouse updateWarehouse(Long id, Warehouse updated) {
        Warehouse existing = getWarehouseById(id);

        existing.setName(updated.getName());
        existing.setLocation(updated.getLocation());
        existing.setMaxCapacity(updated.getMaxCapacity());

        // keep currentCapacity <= maxCapacity
        if (existing.getCurrentCapacity() > existing.getMaxCapacity()) {
            existing.setCurrentCapacity(existing.getMaxCapacity());
        }

        return warehouseRepository.save(existing);
    }

    public void deleteWarehouse(Long id) {
        Warehouse existing = getWarehouseById(id);
        warehouseRepository.delete(existing);
    }
}