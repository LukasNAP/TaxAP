import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_COMMENT_LENGTH = 65_535;

function findEndOfCentralDirectory(buffer) {
  const searchStart = Math.max(0, buffer.length - 22 - MAX_COMMENT_LENGTH);
  for (let offset = buffer.length - 22; offset >= searchStart; offset--) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error("No end-of-central-directory record was found in the archive.");
}

/**
 * Reads a standard (non-Zip64) ZIP archive and returns every entry with its decompressed bytes.
 * Supports only the storage methods official government rate/boundary archives use: stored (0) and deflate (8).
 */
export function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    throw new Error("The archive uses Zip64 or is otherwise not a supported plain ZIP file.");
  }

  const entries = [];
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Central directory entry ${index + 1} has an invalid signature.`);
    }
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const fileCommentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);

    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Local file header for "${name}" has an invalid signature.`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedBytes = buffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (compressionMethod === 0) {
      data = compressedBytes;
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedBytes);
    } else {
      throw new Error(`"${name}" uses unsupported ZIP compression method ${compressionMethod}.`);
    }
    if (data.length !== uncompressedSize) {
      throw new Error(`"${name}" decompressed to ${data.length} bytes, expected ${uncompressedSize}.`);
    }
    entries.push({ name, data });
    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return entries;
}

/** Reads a ZIP archive that is expected to contain exactly one file and returns it. */
export function readSingleFileZip(buffer) {
  const entries = readZipEntries(buffer);
  if (entries.length !== 1) throw new Error(`Expected exactly one file in the archive, found ${entries.length}.`);
  return entries[0];
}
