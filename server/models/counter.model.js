import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    sequence: {
      type: Number,
      default: 1000,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;
