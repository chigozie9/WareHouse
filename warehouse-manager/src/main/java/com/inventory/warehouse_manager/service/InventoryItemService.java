package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.InventoryItemRepository;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InventoryItemService {

    private final InventoryItemRepository itemRepo;
    private final WarehouseRepository warehouseRepo;

    public InventoryItemService(InventoryItemRepository itemRepo, WarehouseRepository warehouseRepo) {
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
    }

    public List<InventoryItem> getItems(Long warehouseId) {
        return itemRepo.findByWarehouseId(warehouseId);
    }

    public InventoryItem addItem(Long warehouseId, InventoryItem item) {
        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));

        int available = warehouse.getMaxCapacity() - warehouse.getCurrentCapacity();
        if (item.getQuantity() > available) {
            throw new IllegalArgumentException("Not enough capacity. Available: " + available);
        }

        // Handle duplicate SKU: merge quantities
        var existing = itemRepo.findByWarehouseIdAndSku(warehouseId, item.getSku());
        if (existing.isPresent()) {
            InventoryItem ex = existing.get();
            ex.setQuantity(ex.getQuantity() + item.getQuantity());
            warehouse.setCurrentCapacity(warehouse.getCurrentCapacity() + item.getQuantity());
            warehouseRepo.save(warehouse);
            return itemRepo.save(ex);
        }

        item.setWarehouse(warehouse);
        warehouse.setCurrentCapacity(warehouse.getCurrentCapacity() + item.getQuantity());
        warehouseRepo.save(warehouse);

        return itemRepo.save(item);
    }

    public void deleteItem(Long id) {
        InventoryItem item = itemRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        Warehouse w = item.getWarehouse();
        w.setCurrentCapacity(w.getCurrentCapacity() - item.getQuantity());

        itemRepo.delete(item);
        warehouseRepo.save(w);
    }
}
