package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.InventoryItemRepository;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepo;
    private final InventoryItemRepository itemRepo;

    public WarehouseService(WarehouseRepository warehouseRepo,
                            InventoryItemRepository itemRepo) {
        this.warehouseRepo = warehouseRepo;
        this.itemRepo = itemRepo;
    }

    public List<Warehouse> getAllWarehouses() {
        return warehouseRepo.findAll();
    }

    public Warehouse getWarehouseById(Long id) {
        return warehouseRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));
    }

    public Warehouse createWarehouse(Warehouse warehouse) {
        warehouse.setId(null); // ensure new
        if (warehouse.getCurrentCapacity() == null) {
            warehouse.setCurrentCapacity(0);
        }
        if (warehouse.getCurrentCapacity() > warehouse.getMaxCapacity()) {
            throw new IllegalArgumentException("Current capacity cannot exceed max capacity");
        }
        return warehouseRepo.save(warehouse);
    }

    public Warehouse updateWarehouse(Long id, Warehouse updated) {
        Warehouse existing = getWarehouseById(id);

        existing.setName(updated.getName());
        existing.setLocation(updated.getLocation());
        existing.setMaxCapacity(updated.getMaxCapacity());

        if (existing.getCurrentCapacity() > existing.getMaxCapacity()) {
            throw new IllegalArgumentException("Current capacity cannot exceed new max capacity");
        }

        return warehouseRepo.save(existing);
    }

    public void deleteWarehouse(Long id) {
        // Block deletion if warehouse still has items
        boolean hasItems = itemRepo.existsByWarehouseId(id);
        if (hasItems) {
            throw new IllegalStateException(
                    "Cannot delete warehouse that still has inventory items.");
        }

        Warehouse warehouse = warehouseRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));

        warehouseRepo.delete(warehouse);
    }
}
