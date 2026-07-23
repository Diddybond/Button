/* kernel.c — the ButtonOS kernel.
 *
 * A single freestanding translation unit: no libc, no operating system beneath
 * us. We talk to the hardware directly through port I/O and the VGA text
 * buffer. The kernel boots, prints a banner, and then runs a tiny shell that
 * reads the keyboard and responds to a few commands.
 *
 * Everything printed to the screen is mirrored to the first serial port
 * (COM1). That is what lets the OS be boot-tested headlessly. */

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

/* ---- Port I/O -------------------------------------------------------------
 * x86 devices live in a separate address space reached with the in/out
 * instructions rather than ordinary memory loads and stores. */

static inline void outb(uint16_t port, uint8_t val) {
    __asm__ volatile("outb %0, %1" : : "a"(val), "Nd"(port));
}

static inline uint8_t inb(uint16_t port) {
    uint8_t ret;
    __asm__ volatile("inb %1, %0" : "=a"(ret) : "Nd"(port));
    return ret;
}

/* ---- Serial port (COM1) ---------------------------------------------------
 * Used as a debug/console mirror so the OS can be observed without a display. */

#define COM1 0x3F8

static void serial_init(void) {
    outb(COM1 + 1, 0x00); /* disable interrupts */
    outb(COM1 + 3, 0x80); /* enable the divisor latch */
    outb(COM1 + 0, 0x03); /* divisor low byte: 38400 baud */
    outb(COM1 + 1, 0x00); /* divisor high byte */
    outb(COM1 + 3, 0x03); /* 8 bits, no parity, one stop bit */
    outb(COM1 + 2, 0xC7); /* enable and clear the FIFO */
    outb(COM1 + 4, 0x0B); /* mark data terminal ready */
}

static void serial_putc(char c) {
    while ((inb(COM1 + 5) & 0x20) == 0) { /* wait for the transmit buffer */ }
    outb(COM1, (uint8_t)c);
}

/* ---- VGA text mode --------------------------------------------------------
 * The video card exposes an 80x25 grid of characters at physical 0xB8000.
 * Each cell is two bytes: an ASCII code and a colour attribute. */

#define VGA_WIDTH  80
#define VGA_HEIGHT 25
static volatile uint16_t *const VGA = (uint16_t *)0xB8000;

enum vga_color {
    VGA_BLACK = 0, VGA_BLUE, VGA_GREEN, VGA_CYAN, VGA_RED, VGA_MAGENTA,
    VGA_BROWN, VGA_LIGHT_GREY, VGA_DARK_GREY, VGA_LIGHT_BLUE,
    VGA_LIGHT_GREEN, VGA_LIGHT_CYAN, VGA_LIGHT_RED, VGA_LIGHT_MAGENTA,
    VGA_YELLOW, VGA_WHITE,
};

static size_t vga_row, vga_col;
static uint8_t vga_color = (VGA_BLACK << 4) | VGA_LIGHT_GREY;

static inline uint16_t vga_cell(char c, uint8_t color) {
    return (uint16_t)c | ((uint16_t)color << 8);
}

static void vga_set_color(enum vga_color fg, enum vga_color bg) {
    vga_color = (uint8_t)((bg << 4) | fg);
}

static void vga_clear(void) {
    for (size_t y = 0; y < VGA_HEIGHT; y++)
        for (size_t x = 0; x < VGA_WIDTH; x++)
            VGA[y * VGA_WIDTH + x] = vga_cell(' ', vga_color);
    vga_row = vga_col = 0;
}

/* Move the hardware cursor so the blinking caret follows our writes. */
static void vga_move_cursor(void) {
    uint16_t pos = (uint16_t)(vga_row * VGA_WIDTH + vga_col);
    outb(0x3D4, 14); outb(0x3D5, (uint8_t)(pos >> 8));
    outb(0x3D4, 15); outb(0x3D5, (uint8_t)(pos & 0xFF));
}

static void vga_scroll(void) {
    for (size_t y = 1; y < VGA_HEIGHT; y++)
        for (size_t x = 0; x < VGA_WIDTH; x++)
            VGA[(y - 1) * VGA_WIDTH + x] = VGA[y * VGA_WIDTH + x];
    for (size_t x = 0; x < VGA_WIDTH; x++)
        VGA[(VGA_HEIGHT - 1) * VGA_WIDTH + x] = vga_cell(' ', vga_color);
    vga_row = VGA_HEIGHT - 1;
}

/* Write one character to the screen, honouring newlines and backspace, and
 * mirror it to the serial line. */
static void putc(char c) {
    serial_putc(c);

    if (c == '\n') {
        vga_col = 0;
        if (++vga_row == VGA_HEIGHT) vga_scroll();
    } else if (c == '\b') {
        if (vga_col > 0) {
            vga_col--;
            VGA[vga_row * VGA_WIDTH + vga_col] = vga_cell(' ', vga_color);
        }
    } else {
        VGA[vga_row * VGA_WIDTH + vga_col] = vga_cell(c, vga_color);
        if (++vga_col == VGA_WIDTH) {
            vga_col = 0;
            if (++vga_row == VGA_HEIGHT) vga_scroll();
        }
    }
    vga_move_cursor();
}

static void puts(const char *s) {
    while (*s) putc(*s++);
}

/* ---- Small string helpers -------------------------------------------------
 * Freestanding code gets no libc, so we roll the few routines we need. */

static int str_eq(const char *a, const char *b) {
    while (*a && *b && *a == *b) { a++; b++; }
    return *a == *b;
}

/* Does `s` begin with `prefix`? Returns a pointer past the prefix, or NULL. */
static const char *str_after(const char *s, const char *prefix) {
    while (*prefix) {
        if (*s != *prefix) return NULL;
        s++; prefix++;
    }
    return s;
}

/* ---- PS/2 keyboard --------------------------------------------------------
 * We poll the controller rather than using interrupts: simpler, and plenty for
 * a shell. Scancode set 1 arrives on port 0x60; the high bit marks a key
 * release. We track shift ourselves to get upper-case and symbols. */

static const char kbd_lower[128] = {
    0, 27, '1','2','3','4','5','6','7','8','9','0','-','=', '\b',
    '\t','q','w','e','r','t','y','u','i','o','p','[',']','\n',
    0, 'a','s','d','f','g','h','j','k','l',';','\'','`',
    0, '\\','z','x','c','v','b','n','m',',','.','/',
    0, '*', 0, ' ',
};

static const char kbd_upper[128] = {
    0, 27, '!','@','#','$','%','^','&','*','(',')','_','+', '\b',
    '\t','Q','W','E','R','T','Y','U','I','O','P','{','}','\n',
    0, 'A','S','D','F','G','H','J','K','L',':','"','~',
    0, '|','Z','X','C','V','B','N','M','<','>','?',
    0, '*', 0, ' ',
};

/* Block until a key is pressed and return its ASCII value (0 for keys we do
 * not map, such as function or arrow keys). */
static char keyboard_getchar(void) {
    static bool shift = false;
    for (;;) {
        if ((inb(0x64) & 1) == 0) continue;   /* output buffer empty */
        uint8_t sc = inb(0x60);

        if (sc == 0x2A || sc == 0x36) { shift = true;  continue; } /* shift down */
        if (sc == 0xAA || sc == 0xB6) { shift = false; continue; } /* shift up */
        if (sc & 0x80) continue;              /* some other key release */

        char c = shift ? kbd_upper[sc] : kbd_lower[sc];
        if (c) return c;
    }
}

/* Read a line of input into `buf`, echoing as we go and handling backspace. */
static void read_line(char *buf, size_t max) {
    size_t len = 0;
    for (;;) {
        char c = keyboard_getchar();
        if (c == '\n') {
            putc('\n');
            buf[len] = '\0';
            return;
        } else if (c == '\b') {
            if (len > 0) { len--; putc('\b'); }
        } else if (len + 1 < max) {
            buf[len++] = c;
            putc(c);
        }
    }
}

/* ---- Banner and shell ----------------------------------------------------- */

static void print_banner(void) {
    vga_set_color(VGA_LIGHT_CYAN, VGA_BLACK);
    puts("\n");
    puts("   ____        _   _              ___  ____\n");
    puts("  | __ ) _   _| |_| |_ ___  _ __ / _ \\/ ___|\n");
    puts("  |  _ \\| | | | __| __/ _ \\| '_ \\ | | \\___ \\\n");
    puts("  | |_) | |_| | |_| || (_) | | | | |_| |___) |\n");
    puts("  |____/ \\__,_|\\__|\\__\\___/|_| |_|\\___/|____/\n");
    vga_set_color(VGA_DARK_GREY, VGA_BLACK);
    puts("  a tiny operating system  .  v0.1\n\n");
    vga_set_color(VGA_LIGHT_GREY, VGA_BLACK);
    puts("Booted. Type 'help' for a list of commands.\n\n");
}

static void cmd_help(void) {
    puts("commands:\n");
    puts("  help          show this list\n");
    puts("  about         what is this\n");
    puts("  clear         clear the screen\n");
    puts("  echo <text>   print text back\n");
    puts("  colors        show the VGA palette\n");
    puts("  reboot        restart the machine\n");
}

static void cmd_about(void) {
    puts("ButtonOS is a hobby operating system written from scratch in C and\n");
    puts("x86 assembly. It boots via Multiboot, drives the VGA text console and\n");
    puts("the PS/2 keyboard directly, and mirrors output to the serial port.\n");
    puts("There is no filesystem, no processes, no networking -- yet. It is a\n");
    puts("foundation to grow.\n");
}

static void cmd_colors(void) {
    for (int fg = 0; fg < 16; fg++) {
        vga_set_color((enum vga_color)fg, VGA_BLACK);
        puts(" ButtonOS ");
    }
    vga_set_color(VGA_LIGHT_GREY, VGA_BLACK);
    putc('\n');
}

static void reboot(void) {
    puts("rebooting...\n");
    /* Pulse the CPU reset line via the 8042 keyboard controller. */
    uint8_t good = 0x02;
    while (good & 0x02) good = inb(0x64);
    outb(0x64, 0xFE);
    /* If that somehow fails, triple-fault by loading a null IDT and faulting. */
    __asm__ volatile("cli; hlt");
}

static void run_command(const char *line) {
    const char *rest;

    if (line[0] == '\0') {
        return;
    } else if (str_eq(line, "help")) {
        cmd_help();
    } else if (str_eq(line, "about")) {
        cmd_about();
    } else if (str_eq(line, "clear")) {
        vga_clear();
    } else if (str_eq(line, "colors") || str_eq(line, "colours")) {
        cmd_colors();
    } else if (str_eq(line, "reboot")) {
        reboot();
    } else if ((rest = str_after(line, "echo ")) != NULL) {
        puts(rest);
        putc('\n');
    } else if (str_eq(line, "echo")) {
        putc('\n');
    } else {
        puts("unknown command: ");
        puts(line);
        puts("  (try 'help')\n");
    }
}

/* ---- Entry point ----------------------------------------------------------
 * Called from boot.asm. The two arguments are the Multiboot magic and a
 * pointer to the info structure; we don't need them yet. */

void kmain(uint32_t magic, uint32_t info) {
    (void)magic; (void)info;

    serial_init();
    vga_set_color(VGA_LIGHT_GREY, VGA_BLACK);
    vga_clear();
    print_banner();

    char line[128];
    for (;;) {
        vga_set_color(VGA_LIGHT_GREEN, VGA_BLACK);
        puts("button> ");
        vga_set_color(VGA_LIGHT_GREY, VGA_BLACK);
        read_line(line, sizeof line);
        run_command(line);
    }
}
