FROM nginx:alpine

# Copy the public directory
COPY public /usr/share/nginx/html

# Copy the src directory inside public so relative paths work
COPY src /usr/share/nginx/html/src

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80 for K8s
EXPOSE 80

# Use nginx for production serving
CMD ["nginx", "-g", "daemon off;"]