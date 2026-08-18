import mongoose from 'mongoose';

type DocumentRecord = {
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  processedAt?: Date;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  chunkCount?: number;
  vectorCount?: number;
  contentLength?: number;
};

type MessageRecord = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  documentId?: string;
  context?: string;
};

type DevStore = {
  documents: Map<string, DocumentRecord>;
  messages: MessageRecord[];
  useDevStore: boolean;
  isConnected: boolean;
  connectPromise: Promise<void> | null;
};

function getDevStore(): DevStore {
  const globalStore = globalThis as typeof globalThis & {
    __ragDevStore?: DevStore;
  };

  if (!globalStore.__ragDevStore) {
    globalStore.__ragDevStore = {
      documents: new Map(),
      messages: [],
      useDevStore: false,
      isConnected: false,
      connectPromise: null,
    };
  }

  return globalStore.__ragDevStore;
}

async function connectOnce(): Promise<void> {
  const store = getDevStore();

  if (store.isConnected) {
    return;
  }

  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    try {
      await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 8000 });
      store.useDevStore = false;
      store.isConnected = true;
      console.log('✅ Connected to MongoDB with Mongoose:', configuredUri.replace(/\/\/([^@/]+)@/, '//***@'));
      return;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ MongoDB connection error:', error);
        throw error;
      }

      console.warn('Could not connect to configured MongoDB, using in-memory store for development');
      await mongoose.disconnect().catch(() => undefined);
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI environment variable is required');
  }

  store.useDevStore = true;
  store.isConnected = true;
  console.log('✅ Using in-memory document store for development');
}

export async function connectDB(): Promise<void> {
  const store = getDevStore();

  if (store.isConnected) {
    return;
  }

  if (!store.connectPromise) {
    store.connectPromise = connectOnce().finally(() => {
      // Keep the settled promise so concurrent callers still await the same result
      // after isConnected is true; clear only on hard failure in production.
      if (!store.isConnected) {
        store.connectPromise = null;
      }
    });
  }

  await store.connectPromise;
}

const DocumentSchema = new mongoose.Schema({
  documentId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  filename: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'error'],
    default: 'uploading'
  },
  errorMessage: { type: String },
  chunkCount: { type: Number },
  vectorCount: { type: Number },
  contentLength: { type: Number }
}, {
  timestamps: true
});

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  conversationId: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  documentId: { type: String },
  context: { type: String }
});

export const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

export async function createDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    store.documents.set(doc.documentId, { ...doc });
    return doc;
  }

  return await Document.create(doc);
}

export async function getDocument(documentId: string): Promise<DocumentRecord | null> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    return store.documents.get(documentId) ?? null;
  }

  return await Document.findOne({ documentId });
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    return Array.from(store.documents.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  return await Document.find({}).sort({ uploadedAt: -1 });
}

export async function updateDocument(
  documentId: string,
  updates: Partial<DocumentRecord>
): Promise<DocumentRecord | null> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    const existing = store.documents.get(documentId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    store.documents.set(documentId, updated);
    return updated;
  }

  return await Document.findOneAndUpdate(
    { documentId },
    updates,
    { returnDocument: 'after' }
  );
}

export async function deleteDocument(documentId: string): Promise<DocumentRecord | null> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    const existing = store.documents.get(documentId) ?? null;
    store.documents.delete(documentId);
    return existing;
  }

  return await Document.findOneAndDelete({ documentId });
}

export async function saveMessage(message: MessageRecord): Promise<MessageRecord> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    store.messages.push(message);
    return message;
  }

  return await Message.create(message);
}

export async function getMessages(conversationId: string): Promise<MessageRecord[]> {
  await connectDB();
  const store = getDevStore();

  if (store.useDevStore) {
    return store.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return await Message.find({ conversationId }).sort({ createdAt: 1 });
}
