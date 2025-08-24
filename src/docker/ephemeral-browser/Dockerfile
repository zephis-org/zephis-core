FROM node:18-slim

# Install dependencies for Chrome and VNC
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    x11vnc \
    xvfb \
    fluxbox \
    novnc \
    websockify \
    supervisor \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up VNC environment
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1920
ENV SCREEN_HEIGHT=1080
ENV SCREEN_DEPTH=24
ENV VNC_PASSWORD=zephis

# Create working directory
WORKDIR /app

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create startup script
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} &\n\
sleep 2\n\
fluxbox &\n\
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever &\n\
websockify --web=/usr/share/novnc 6080 localhost:5900 &\n\
google-chrome-stable --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu &\n\
wait' > /app/start.sh && chmod +x /app/start.sh

# Expose VNC ports
EXPOSE 5900 6080

# Add ZEPHIS label
LABEL zephis=true

# Start services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]