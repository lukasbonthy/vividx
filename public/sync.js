document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById('videoPlayer');
    const SYNC_INTERVAL = 5000; // Sync every 5 seconds

    // Function to synchronize video
    function synchronizeVideo() {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('code');
        fetch(`/time/${roomCode}`)
            .then(response => response.json())
            .then(data => {
                if (Math.abs(data.currentTime - video.currentTime) > 1) {
                    video.currentTime = data.currentTime;
                }
            })
            .catch(err => console.error('Failed to sync video:', err));
    }

    // Start video and periodically sync
    setInterval(synchronizeVideo, SYNC_INTERVAL);
});
