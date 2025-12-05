package com.inventory.warehouse_manager.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TransferRequest {

    @NotNull
    private Long sourceWarehouseId;

    @NotNull
    private Long destinationWarehouseId;

    @NotNull
    private String sku;

    @NotNull
    @Min(1)
    private Integer quantity;
}
