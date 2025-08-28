FROM nginx:alpine
COPY public /usr/share/nginx/html
COPY src /usr/share/nginx/html/src
COPY nginx.conf /etc/nginx/nginx.conf
