const fs = require('fs');

/**
 * Attempts to delete all the raw PCM chunk files generated during the session.
 */
function cleanupSessionData(sessionData) {
    if (!sessionData || !sessionData.chunks) return;

    let successCount = 0;
    
    sessionData.chunks.forEach((chunk) => {
        try {
            if (fs.existsSync(chunk.filePath)) {
                fs.unlinkSync(chunk.filePath);
                successCount++;
            }
        } catch (error) {
            console.error(`[Cleanup] Failed to delete chunk file: ${chunk.filePath}`, error);
        }
    });

    console.log(`[Cleanup] Successfully removed ${successCount}/${sessionData.chunks.length} PCM temporary files.`);
}

module.exports = {
    cleanupSessionData
};
