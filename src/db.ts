import mongoose, { Schema, Document } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export interface ILinkSubmission {
  id: string;
  marketplace: 'shopee' | 'tokopedia' | 'tiktok' | 'lainnya';
  productUrl: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  priceEstimate?: string;
  createdAt: string;
}

const LinkSubmissionSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  marketplace: { 
    type: String, 
    required: true, 
    enum: ['shopee', 'tokopedia', 'tiktok', 'lainnya'] 
  },
  productUrl: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, default: "" },
  quantity: { type: Number, required: true, default: 1 },
  notes: { type: String, default: "" },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  priceEstimate: { type: String, default: "" },
  createdAt: { type: String, required: true }
});

export const LinkSubmissionModel: any = mongoose.models.LinkSubmission || mongoose.model("LinkSubmission", LinkSubmissionSchema);

// Connection status
let isConnected = false;
let isConnecting = false;

// Dynamic in-memory fallback array in case DB isn't ready
let memorySubmissions: ILinkSubmission[] = [];

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes("<db_password>") || uri.includes("MY_MONGODB_URI")) {
    console.warn("⚠️ MONGODB_URI belum dikonfigurasi dengan kata sandi yang valid. Menggunakan penyimpanan memori sementara.");
    return false;
  }

  if (isConnected || isConnecting) return isConnected;

  isConnecting = true;
  try {
    console.log("🔌 Menghubungkan ke MongoDB Atlas...");
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    isConnecting = false;
    console.log("✅ Berhasil terhubung ke MongoDB Atlas!");
    return true;
  } catch (error) {
    isConnecting = false;
    console.error("❌ Gagal terhubung ke MongoDB Atlas:", error);
    return false;
  }
}

// Database Operations
export async function getSubmissions(): Promise<ILinkSubmission[]> {
  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      // Fetch from MongoDB
      const docs = await LinkSubmissionModel.find().sort({ createdAt: -1 });
      return docs.map(doc => ({
        id: doc.id,
        marketplace: doc.marketplace,
        productUrl: doc.productUrl,
        customerName: doc.customerName,
        customerPhone: doc.customerPhone,
        customerAddress: doc.customerAddress || "",
        quantity: doc.quantity,
        notes: doc.notes,
        status: doc.status,
        priceEstimate: doc.priceEstimate,
        createdAt: doc.createdAt
      }));
    } catch (err) {
      console.error("Gagal membaca data dari MongoDB, menggunakan memori lokal:", err);
    }
  }
  return memorySubmissions;
}

export async function addSubmission(data: Omit<ILinkSubmission, 'id' | 'status' | 'priceEstimate' | 'createdAt'>): Promise<ILinkSubmission> {
  const newId = `sub-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  
  const newSubmission: ILinkSubmission = {
    ...data,
    id: newId,
    status: 'pending',
    priceEstimate: "",
    createdAt: now
  };

  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      await LinkSubmissionModel.create(newSubmission);
      console.log(`📦 Pesanan baru (${newId}) disimpan ke MongoDB Atlas!`);
      return newSubmission;
    } catch (err) {
      console.error("Gagal meyimpan ke MongoDB, beralih ke memori lokal:", err);
    }
  }

  // Fallback to in-memory
  memorySubmissions.unshift(newSubmission);
  return newSubmission;
}

export async function updateSubmission(id: string, updates: { status?: 'pending' | 'processing' | 'completed' | 'cancelled'; priceEstimate?: string }): Promise<ILinkSubmission | null> {
  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      const updatedDoc = await LinkSubmissionModel.findOneAndUpdate(
        { id },
        { $set: updates },
        { new: true }
      );
      if (updatedDoc) {
        return {
          id: updatedDoc.id,
          marketplace: updatedDoc.marketplace,
          productUrl: updatedDoc.productUrl,
          customerName: updatedDoc.customerName,
          customerPhone: updatedDoc.customerPhone,
          customerAddress: updatedDoc.customerAddress || "",
          quantity: updatedDoc.quantity,
          notes: updatedDoc.notes,
          status: updatedDoc.status,
          priceEstimate: updatedDoc.priceEstimate,
          createdAt: updatedDoc.createdAt
        };
      }
    } catch (err) {
      console.error("Gagal memperbarui di MongoDB, mencoba di memori lokal:", err);
    }
  }

  // Fallback update
  const idx = memorySubmissions.findIndex(item => item.id === id);
  if (idx !== -1) {
    if (updates.status) memorySubmissions[idx].status = updates.status;
    if (updates.priceEstimate !== undefined) memorySubmissions[idx].priceEstimate = updates.priceEstimate;
    return memorySubmissions[idx];
  }
  return null;
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      const deleted = await LinkSubmissionModel.findOneAndDelete({ id });
      if (deleted) {
        return true;
      }
    } catch (err) {
      console.error("Gagal menghapus di MongoDB, mencoba di memori lokal:", err);
    }
  }

  // Fallback delete
  const exists = memorySubmissions.some(item => item.id === id);
  if (exists) {
    memorySubmissions = memorySubmissions.filter(item => item.id !== id);
    return true;
  }
  return false;
}

// ---------------------- LIVE CHAT SUPPORT ----------------------

export interface IChatMessage {
  submissionId: string;
  sender: 'admin' | 'customer';
  message: string;
  createdAt: string;
}

const ChatMessageSchema: Schema = new Schema({
  submissionId: { type: String, required: true },
  sender: { type: String, required: true, enum: ['admin', 'customer'] },
  message: { type: String, required: true },
  createdAt: { type: String, required: true }
});

export const ChatMessageModel: any = mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);

let memoryMessages: IChatMessage[] = [];

export async function getMessages(submissionId: string): Promise<IChatMessage[]> {
  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      const docs = await ChatMessageModel.find({ submissionId }).sort({ createdAt: 1 });
      return docs.map(doc => ({
        submissionId: doc.submissionId,
        sender: doc.sender,
        message: doc.message,
        createdAt: doc.createdAt
      }));
    } catch (err) {
      console.error("Gagal membaca chat dari MongoDB, menggunakan memori lokal:", err);
    }
  }
  return memoryMessages.filter(m => m.submissionId === submissionId);
}

export async function addMessage(submissionId: string, sender: 'admin' | 'customer', message: string): Promise<IChatMessage> {
  const newMessage: IChatMessage = {
    submissionId,
    sender,
    message,
    createdAt: new Date().toISOString()
  };

  const dbResult = await connectDatabase();
  if (dbResult) {
    try {
      await ChatMessageModel.create(newMessage);
      return newMessage;
    } catch (err) {
      console.error("Gagal meyimpan chat ke MongoDB, beralih ke memori lokal:", err);
    }
  }

  memoryMessages.push(newMessage);
  return newMessage;
}
