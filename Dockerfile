FROM nginx:alpine

# Copy the public directory
COPY public /usr/share/nginx/html

# Copy the src directory inside public so relative paths work
COPY src /usr/share/nginx/html/src

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 8080 for K8s (unprivileged)
EXPOSE 8080

# Use nginx for production serving
CMD ["nginx", "-g", "daemon off;"]