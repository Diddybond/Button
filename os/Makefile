# Makefile for ButtonOS
#
# Builds a freestanding 32-bit x86 kernel and boots it in QEMU. We use clang as
# a cross-compiler (targeting i386-elf) so no special GCC cross-toolchain has to
# be installed; nasm assembles the boot stub and the system linker links it.

TARGET  := i386-elf
CC      := clang
AS      := nasm
LD      := ld

CFLAGS  := --target=$(TARGET) -m32 -ffreestanding -fno-stack-protector \
           -fno-pic -nostdlib -Wall -Wextra -O2 -std=c11
ASFLAGS := -f elf32
LDFLAGS := -m elf_i386 -T src/linker.ld -nostdlib

BUILD   := build
KERNEL  := $(BUILD)/kernel.elf
OBJS    := $(BUILD)/boot.o $(BUILD)/kernel.o

.PHONY: all run run-gui clean

all: $(KERNEL)

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/boot.o: src/boot.asm | $(BUILD)
	$(AS) $(ASFLAGS) $< -o $@

$(BUILD)/kernel.o: src/kernel.c | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(KERNEL): $(OBJS)
	$(LD) $(LDFLAGS) -o $@ $(OBJS)

# Boot in QEMU with a window (needs a graphical environment).
run-gui: $(KERNEL)
	qemu-system-i386 -kernel $(KERNEL)

# Boot headless: the console is mirrored to the serial line on stdio.
run: $(KERNEL)
	qemu-system-i386 -kernel $(KERNEL) -display none -serial stdio

clean:
	rm -rf $(BUILD)
