package com.inventory.warehouse_manager.controller;

import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.service.InventoryItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/warehouses/{warehouseId}/items")
public class InventoryItemController {

    private final InventoryItemService service;

    public InventoryItemController(InventoryItemService service) {
        this.service = service;
    }

    @GetMapping
    public List<InventoryItem> listItems(@PathVariable("warehouseId") Long warehouseId) {
        return service.getItems(warehouseId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryItem addItem(@PathVariable("warehouseId") Long warehouseId,
                                 @Valid @RequestBody InventoryItem item) {
        return service.addItem(warehouseId, item);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable("warehouseId") Long warehouseId,
                           @PathVariable("itemId") Long itemId) {
        // warehouseId not needed in service, but we bind it correctly here
        service.deleteItem(itemId);
    }
}
