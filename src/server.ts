import express from 'express';

import createEntity from './useCases/createEntity';

const app = express();

app.use(express.json());

app.post('/entities', async (req, res) => {
  const entity = createEntity(req.body);

  res.json(entity);
});

app.listen(process.env.PORT, () => {
  console.info('APP listening on port', process.env.PORT);
});
