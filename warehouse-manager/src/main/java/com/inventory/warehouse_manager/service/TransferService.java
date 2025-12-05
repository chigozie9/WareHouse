package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.dto.TransferRequest;
import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.InventoryItemRepository;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;

@Service
public class TransferService {

    private final WarehouseRepository warehouseRepo;
    private final InventoryItemRepository itemRepo;

    public TransferService(WarehouseRepository warehouseRepo,
                           InventoryItemRepository itemRepo) {
        this.warehouseRepo = warehouseRepo;
        this.itemRepo = itemRepo;
    }

    public void transfer(TransferRequest request) {

        Warehouse source = warehouseRepo.findById(request.getSourceWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Source warehouse not found"));

        Warehouse dest = warehouseRepo.findById(request.getDestinationWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Destination warehouse not found"));

        // find item in source warehouse
        InventoryItem sourceItem = itemRepo
                .findByWarehouseIdAndSku(source.getId(), request.getSku())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Item with SKU " + request.getSku() + " not found in source warehouse"));

        int qty = request.getQuantity();

        if (qty <= 0) {
            throw new IllegalArgumentException("Quantity must be > 0");
        }

        if (sourceItem.getQuantity() < qty) {
            throw new IllegalArgumentException("Not enough quantity in source warehouse");
        }

        int destAvailable = dest.getMaxCapacity() - dest.getCurrentCapacity();
        if (qty > destAvailable) {
            throw new IllegalArgumentException("Not enough capacity in destination warehouse. Available: " + destAvailable);
        }

        // 1) deduct from source
        sourceItem.setQuantity(sourceItem.getQuantity() - qty);
        source.setCurrentCapacity(source.getCurrentCapacity() - qty);

        // if quantity hits 0 you could delete the item, but not required:
        // if (sourceItem.getQuantity() == 0) itemRepo.delete(sourceItem);

        // 2) add to destination (merge if SKU already exists there)
        InventoryItem destItem = itemRepo
                .findByWarehouseIdAndSku(dest.getId(), request.getSku())
                .orElseGet(() -> {
                    InventoryItem newItem = new InventoryItem();
                    newItem.setName(sourceItem.getName());
                    newItem.setSku(sourceItem.getSku());
                    newItem.setDescription(sourceItem.getDescription());
                    newItem.setCategory(sourceItem.getCategory());
                    newItem.setStorageLocation("TBD");
                    newItem.setExpirationDate(sourceItem.getExpirationDate());
                    newItem.setWarehouse(dest);
                    newItem.setQuantity(0);
                    return newItem;
                });

        destItem.setQuantity(destItem.getQuantity() + qty);
        dest.setCurrentCapacity(dest.getCurrentCapacity() + qty);

        // save everything
        itemRepo.save(sourceItem);
        itemRepo.save(destItem);
        warehouseRepo.save(source);
        warehouseRepo.save(dest);
    }
}
