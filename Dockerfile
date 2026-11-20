FROM node:26.13.0
WORKDIR /rpg

# if package.json changes. Docker deploys auto-update
COPY package.json package-lock.json /rpg/
RUN npm ci
COPY . /rpg
RUN npm run build

EXPOSE 9999
CMD ["npm", "start"]
