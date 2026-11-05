
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is missing from environment variables');
    }

    const connection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `MongoDB Connected Successfully: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error('MongoDB Connection Failed:', error.message);
    throw error;
  }
};

export default connectDB;
