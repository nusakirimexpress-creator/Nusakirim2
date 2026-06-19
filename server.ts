import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  getSubmissions, 
  addSubmission, 
  updateSubmission, 
  deleteSubmission, 
  connectDatabase,
  getMessages,
  addMessage
} from "./src/db";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up built-in express middleware for parsing requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Endpoints
  
  // 1. GET: Fetch all submissions
  app.get("/api/submissions", async (req, res) => {
    try {
      const data = await getSubmissions();
      res.json({
        success: true,
        data
      });
    } catch (err: any) {
      res.status(505).json({
        success: false,
        error: err.message || "Gagal mengambil data dari server"
      });
    }
  });

  // 2. POST: Submit a new shopping link
  app.post("/api/submissions", async (req, res) => {
    const { marketplace, productUrl, customerName, customerPhone, customerAddress, quantity, notes } = req.body;

    if (!marketplace || !productUrl || !customerName || !customerPhone) {
      return res.status(400).json({
        success: false,
        error: "Mohon isi semua bidang wajib (Kategori Toko, Link Produk, Nama, dan No WhatsApp)"
      });
    }

    try {
      const newSubmission = await addSubmission({
        marketplace: marketplace as 'shopee' | 'tokopedia' | 'tiktok' | 'lainnya',
        productUrl,
        customerName,
        customerPhone,
        customerAddress: customerAddress || "",
        quantity: Number(quantity) || 1,
        notes: notes || ""
      });

      // Generate a welcoming automated initial message from the Admin!
      await addMessage(
        newSubmission.id,
        'admin',
        `Halo Kak ${customerName}! 👋 Selamat datang di NusaKirim Live Chat.\n\nPesanan Anda untuk item dari ${marketplace.toUpperCase()} telah kami terima dengan rincian:\n🔗 Link: ${productUrl}\n📦 Jumlah: ${quantity} pcs\n\nAdmin kami sedang mengecek ketersediaan & menghitung estimasi biaya total + kargo Anda. Mohon ditunggu ya! Jika ada pertanyaan atau instruksi tambahan, silakan ketik langsung di sini.`
      );

      res.status(201).json({
        success: true,
        message: "Link belanja Anda berhasil diajukan ke admin jasa pengiriman/pembelian kami!",
        data: newSubmission
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Gagal memproses data di server"
      });
    }
  });

  // 3. PUT: Update submission status and pricing details
  app.put("/api/submissions/:id", async (req, res) => {
    const { id } = req.params;
    const { status, priceEstimate } = req.body;

    try {
      const updated = await updateSubmission(id, {
        status: status as any,
        priceEstimate
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: "Data pesanan tidak ditemukan"
        });
      }

      res.json({
        success: true,
        message: "Status pesanan berhasil diperbarui",
        data: updated
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Gagal memperbarui pesanan di server"
      });
    }
  });

  // 4. DELETE: Remove submission entry
  app.delete("/api/submissions/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const success = await deleteSubmission(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Data pesanan tidak ditemukan"
        });
      }

      res.json({
        success: true,
        message: "Data pesanan berhasil dihapus"
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Gagal menghapus pesanan di server"
      });
    }
  });

  // 5. GET: Fetch chat messages for a specific order submission
  app.get("/api/submissions/:id/messages", async (req, res) => {
    const { id } = req.params;
    try {
      const messages = await getMessages(id);
      res.json({
        success: true,
        data: messages
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Gagal memuat pesan obrolan"
      });
    }
  });

  // 6. POST: Send a chat message for a specific order submission
  app.post("/api/submissions/:id/messages", async (req, res) => {
    const { id } = req.params;
    const { sender, message } = req.body;

    if (!sender || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Pengirim dan pesan tidak boleh kosong"
      });
    }

    try {
      const newMessage = await addMessage(id, sender as 'admin' | 'customer', message.trim());
      res.status(201).json({
        success: true,
        data: newMessage
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Gagal mengirim pesan obrolan"
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RuangKreatif Shipping & Buying Agent Server running on http://localhost:${PORT}`);
    connectDatabase().catch(err => console.error("Database connection failed on startup:", err));
  });
}

startServer();
