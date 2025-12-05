package com.inventory.warehouse_manager.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Entity
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true)
    private String name;

    private String location;

    @NotNull
    @Min(0)
    @Column(nullable = false)
    private Integer maxCapacity;

    @NotNull
    @Min(0)
    @Column(nullable = false)
    private Integer currentCapacity = 0;
}
