package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.dto.TransferRequest;
import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.InventoryItemRepository;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransferService {

    private final WarehouseRepository warehouseRepo;
    private final InventoryItemRepository itemRepo;

    public TransferService(WarehouseRepository warehouseRepo,
                           InventoryItemRepository itemRepo) {
        this.warehouseRepo = warehouseRepo;
        this.itemRepo = itemRepo;
    }

    @Transactional
    public void transfer(TransferRequest request) {
        // 1) Load source & destination warehouses
        Warehouse source = warehouseRepo.findById(request.getSourceWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Source warehouse not found: " + request.getSourceWarehouseId()));

        Warehouse destination = warehouseRepo.findById(request.getDestinationWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Destination warehouse not found: " + request.getDestinationWarehouseId()));

        // 2) Basic validation
        if (source.getId().equals(destination.getId())) {
            throw new IllegalArgumentException("Source and destination warehouses must be different.");
        }

        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new IllegalArgumentException("Transfer quantity must be greater than 0.");
        }

        // 3) Find the item in the SOURCE warehouse by SKU
        InventoryItem sourceItem = itemRepo
                .findByWarehouseIdAndSku(source.getId(), request.getSku())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Item with SKU " + request.getSku() + " does not exist in the source warehouse."));

        int qtyToTransfer = request.getQuantity();
        if (qtyToTransfer > sourceItem.getQuantity()) {
            throw new IllegalArgumentException(
                    "Not enough quantity to transfer. Available in source: " + sourceItem.getQuantity()
            );
        }

        // 4) Check destination capacity
        int availableCapacity = destination.getMaxCapacity() - destination.getCurrentCapacity();
        if (qtyToTransfer > availableCapacity) {
            throw new IllegalArgumentException(
                    "Not enough capacity in destination warehouse. Available: " + availableCapacity
            );
        }

        // 5) Adjust SOURCE item & warehouse capacity
        sourceItem.setQuantity(sourceItem.getQuantity() - qtyToTransfer);
        source.setCurrentCapacity(source.getCurrentCapacity() - qtyToTransfer);

        // If source item hits 0, delete it; otherwise save it
        if (sourceItem.getQuantity() == 0) {
            itemRepo.delete(sourceItem);
        } else {
            itemRepo.save(sourceItem);
        }

        // 6) Find or create corresponding item in DESTINATION warehouse
        InventoryItem destItem = itemRepo
                .findByWarehouseIdAndSku(destination.getId(), request.getSku())   // OPTION A: use existing repo method
                .orElseGet(() -> {
                    InventoryItem newItem = new InventoryItem();
                    newItem.setName(sourceItem.getName());
                    newItem.setSku(sourceItem.getSku());
                    newItem.setDescription(sourceItem.getDescription());
                    newItem.setCategory(sourceItem.getCategory());
                    newItem.setStorageLocation(sourceItem.getStorageLocation());
                    newItem.setWarehouse(destination);
                    newItem.setQuantity(0); // we will add below
                    return newItem;
                });

        destItem.setQuantity(destItem.getQuantity() + qtyToTransfer);
        destination.setCurrentCapacity(destination.getCurrentCapacity() + qtyToTransfer);

        // 7) Persist everything
        warehouseRepo.save(source);
        warehouseRepo.save(destination);
        itemRepo.save(destItem);
    }
}
