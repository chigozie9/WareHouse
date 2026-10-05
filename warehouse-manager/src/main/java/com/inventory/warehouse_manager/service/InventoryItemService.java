package com.inventory.warehouse_manager.service;

import com.inventory.warehouse_manager.exception.ConflictException;
import com.inventory.warehouse_manager.exception.ResourceNotFoundException;
import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import com.inventory.warehouse_manager.repository.InventoryItemRepository;
import com.inventory.warehouse_manager.repository.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class InventoryItemService {

    private final InventoryItemRepository itemRepo;
    private final WarehouseRepository warehouseRepo;

    public InventoryItemService(InventoryItemRepository itemRepo,
                                WarehouseRepository warehouseRepo) {
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
    }

    // ---------------------------------------------------------------------
    // Read
    // ---------------------------------------------------------------------
    public List<InventoryItem> getItems(Long warehouseId) {
        // BUG-5 fix: an unknown warehouse used to return 200 [] (looked like an
        // empty warehouse). Return 404 like every other warehouse endpoint.
        if (!warehouseRepo.existsById(warehouseId)) {
            throw new ResourceNotFoundException("Warehouse not found with id " + warehouseId);
        }
        return itemRepo.findByWarehouseId(warehouseId);
    }

    // ---------------------------------------------------------------------
    // Create (Add Item)
    // ---------------------------------------------------------------------
    @Transactional
    public InventoryItem addItem(Long warehouseId, InventoryItem item) {
        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Warehouse not found with id " + warehouseId));

        int qty = item.getQuantity() != null ? item.getQuantity() : 0;
        if (qty <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0.");
        }

        int available = warehouse.getMaxCapacity() - warehouse.getCurrentCapacity();
        if (qty > available) {
            throw new IllegalArgumentException(
                    "Not enough capacity. Available: " + available);
        }

        // Check for duplicate SKU and merge quantities if present
        InventoryItem savedItem = itemRepo.findByWarehouseIdAndSku(warehouseId, item.getSku())
                .map(existing -> {
                    existing.setName(item.getName());
                    existing.setDescription(item.getDescription());
                    existing.setCategory(item.getCategory());
                    existing.setStorageLocation(item.getStorageLocation());
                    existing.setQuantity(existing.getQuantity() + qty);
                    return existing;
                })
                .orElseGet(() -> {
                    item.setWarehouse(warehouse);
                    return item;
                });

        warehouse.setCurrentCapacity(warehouse.getCurrentCapacity() + qty);
        warehouseRepo.save(warehouse);

        return itemRepo.save(savedItem);
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------
    @Transactional
    public InventoryItem updateItem(Long warehouseId,
                                    Long itemId,
                                    InventoryItem updated) {

        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Warehouse not found with id " + warehouseId));

        InventoryItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Item not found with id " + itemId));

        // Safety check: ensure item belongs to the given warehouse
        if (!item.getWarehouse().getId().equals(warehouseId)) {
            throw new IllegalArgumentException(
                    "Item does not belong to warehouse " + warehouseId);
        }

        // BUG-4 fix: SKUs must stay unique within a warehouse. Without this check an
        // update could create two items with the same SKU, and transfers (which look
        // items up by SKU) would then crash with a 500.
        if (itemRepo.existsByWarehouseIdAndSkuAndIdNot(warehouseId, updated.getSku(), itemId)) {
            throw new ConflictException(
                    "Another item in this warehouse already uses SKU " + updated.getSku() + ".");
        }

        int oldQty = item.getQuantity() != null ? item.getQuantity() : 0;
        int newQty = updated.getQuantity() != null ? updated.getQuantity() : 0;

        if (newQty <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0.");
        }

        int diff = newQty - oldQty;
        if (diff > 0) {
            int available = warehouse.getMaxCapacity() - warehouse.getCurrentCapacity();
            if (diff > available) {
                throw new IllegalArgumentException(
                        "Not enough capacity. Available: " + available);
            }
        }

        // Update fields
        item.setName(updated.getName());
        item.setSku(updated.getSku());
        item.setDescription(updated.getDescription());
        item.setCategory(updated.getCategory());
        item.setStorageLocation(updated.getStorageLocation());
        // BUG-6 fix: expirationDate was never copied, so edits were silently dropped
        item.setExpirationDate(updated.getExpirationDate());
        item.setQuantity(newQty);

        // Adjust warehouse capacity
        warehouse.setCurrentCapacity(warehouse.getCurrentCapacity() + diff);
        warehouseRepo.save(warehouse);

        return itemRepo.save(item);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------
    @Transactional
    public void deleteItem(Long warehouseId, Long itemId) {
        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Warehouse not found with id " + warehouseId));

        InventoryItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Item not found with id " + itemId));

        // Ensure item really belongs to this warehouse
        if (!item.getWarehouse().getId().equals(warehouseId)) {
            throw new IllegalArgumentException(
                    "Item does not belong to warehouse " + warehouseId);
        }

        int qty = item.getQuantity() != null ? item.getQuantity() : 0;

        warehouse.setCurrentCapacity(warehouse.getCurrentCapacity() - qty);
        warehouseRepo.save(warehouse);

        itemRepo.delete(item);
    }
}
