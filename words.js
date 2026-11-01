// Palavras do jogo, separadas por tema.
// Para adicionar palavras, é só incluir na lista do tema (uma palavra ou expressão curta).

export const CATEGORIES = [
  {
    id: 'comida',
    label: 'Comida',
    words: [
      'Pizza', 'Hambúrguer', 'Brigadeiro', 'Coxinha', 'Pão de queijo', 'Feijoada', 'Açaí',
      'Pastel', 'Sushi', 'Lasanha', 'Pipoca', 'Tapioca', 'Moqueca', 'Acarajé', 'Strogonoff',
      'Farofa', 'Pudim', 'Sorvete', 'Chocolate', 'Macarrão', 'Panqueca', 'Esfiha', 'Cuscuz',
      'Bolo de cenoura', 'Pamonha', 'Arroz e feijão', 'Batata frita', 'Cachorro-quente',
      'Omelete', 'Salada', 'Sopa', 'Picanha', 'Pé de moleque', 'Paçoca', 'Beijinho',
      'Torrada', 'Melancia', 'Abacaxi', 'Banana', 'Manga', 'Morango', 'Café', 'Guaraná',
      'Água de coco', 'Chimarrão', 'Milkshake',
    ],
  },
  {
    id: 'lugares',
    label: 'Lugares',
    words: [
      'Praia', 'Aeroporto', 'Hospital', 'Escola', 'Cinema', 'Supermercado', 'Academia',
      'Igreja', 'Shopping', 'Estádio', 'Biblioteca', 'Padaria', 'Farmácia',
      'Parque de diversões', 'Zoológico', 'Museu', 'Hotel', 'Restaurante', 'Delegacia',
      'Banco', 'Posto de gasolina', 'Rodoviária', 'Cemitério', 'Salão de beleza', 'Fazenda',
      'Navio de cruzeiro', 'Estação espacial', 'Circo', 'Feira', 'Lavanderia', 'Cachoeira',
      'Ilha deserta', 'Elevador', 'Sauna', 'Piscina', 'Prisão', 'Castelo', 'Deserto',
      'Floresta', 'Montanha', 'Faculdade', 'Escritório', 'Pet shop', 'Oficina mecânica',
      'Barbearia', 'Lan house',
    ],
  },
  {
    id: 'animais',
    label: 'Animais',
    words: [
      'Cachorro', 'Gato', 'Elefante', 'Girafa', 'Leão', 'Tubarão', 'Pinguim', 'Jacaré',
      'Capivara', 'Tucano', 'Arara', 'Onça-pintada', 'Macaco', 'Cavalo', 'Vaca', 'Galinha',
      'Coruja', 'Polvo', 'Baleia', 'Golfinho', 'Formiga', 'Abelha', 'Borboleta', 'Cobra',
      'Tartaruga', 'Coelho', 'Urso', 'Lobo', 'Camelo', 'Canguru', 'Bicho-preguiça',
      'Morcego', 'Sapo', 'Papagaio', 'Flamingo', 'Zebra', 'Rinoceronte', 'Hipopótamo',
      'Mosquito', 'Lagartixa', 'Porco', 'Ovelha', 'Pato', 'Caranguejo', 'Barata',
      'Tamanduá', 'Mico-leão-dourado',
    ],
  },
  {
    id: 'objetos',
    label: 'Objetos',
    words: [
      'Guarda-chuva', 'Celular', 'Escova de dentes', 'Óculos', 'Relógio', 'Chave',
      'Travesseiro', 'Controle remoto', 'Mochila', 'Garrafa térmica', 'Tesoura', 'Espelho',
      'Vela', 'Lanterna', 'Carregador', 'Fone de ouvido', 'Panela de pressão', 'Ventilador',
      'Geladeira', 'Liquidificador', 'Chinelo', 'Boné', 'Cadeira', 'Violão',
      'Câmera fotográfica', 'Martelo', 'Vassoura', 'Secador de cabelo', 'Microfone', 'Bola',
      'Cobertor', 'Garfo', 'Caneta', 'Livro', 'Calculadora', 'Abajur', 'Mala', 'Rede',
      'Sofá', 'Televisão', 'Notebook', 'Pente', 'Batom', 'Perfume', 'Guarda-roupa', 'Escada',
      'Cofrinho',
    ],
  },
  {
    id: 'profissoes',
    label: 'Profissões',
    words: [
      'Médico', 'Professor', 'Bombeiro', 'Policial', 'Cozinheiro', 'Piloto de avião',
      'Dentista', 'Advogado', 'Jogador de futebol', 'Cantor', 'Ator', 'Motorista de ônibus',
      'Padeiro', 'Cabeleireiro', 'Veterinário', 'Astronauta', 'Mecânico', 'Eletricista',
      'Jardineiro', 'Garçom', 'Fotógrafo', 'Jornalista', 'Programador', 'Engenheiro',
      'Arquiteto', 'Enfermeiro', 'Carteiro', 'Pedreiro', 'Juiz', 'Palhaço', 'Mágico',
      'Salva-vidas', 'Pescador', 'Agricultor', 'Taxista', 'Detetive', 'Youtuber',
      'Personal trainer', 'Psicólogo', 'DJ', 'Manicure', 'Vendedor', 'Segurança', 'Pintor',
      'Costureira', 'Cientista',
    ],
  },
  {
    id: 'lazer',
    label: 'Esportes e lazer',
    words: [
      'Futebol', 'Vôlei', 'Basquete', 'Natação', 'Surfe', 'Skate', 'Tênis', 'Corrida',
      'Ciclismo', 'Boxe', 'Judô', 'Capoeira', 'Xadrez', 'Boliche', 'Karaokê', 'Pescaria',
      'Yoga', 'Musculação', 'Escalada', 'Paraquedismo', 'Golfe', 'Sinuca', 'Futevôlei',
      'Patinação', 'Videogame', 'Dominó', 'Truco', 'Pingue-pongue', 'Handebol', 'Mergulho',
      'Asa-delta', 'Camping', 'Trilha', 'Balé', 'Pipa', 'Queimada', 'Esconde-esconde',
      'Amarelinha', 'Quebra-cabeça', 'Crochê', 'Jardinagem', 'Maratona', 'Piquenique',
      'Bambolê',
    ],
  },
  {
    id: 'festa',
    label: 'Festa',
    words: [
      'Aniversário', 'Casamento', 'Carnaval', 'Festa junina', 'Réveillon', 'Balada', 'Show',
      'Formatura', 'Chá de bebê', 'Happy hour', 'Luau', 'Bloco de rua', 'Amigo secreto',
      'Quentão', 'Caipirinha', 'Cerveja', 'Vinho', 'Chope', 'Champanhe', 'Confete', 'Balão',
      'Bolo de aniversário', 'Fantasia', 'Pista de dança', 'Fogos de artifício', 'Ressaca',
      'Selfie', 'Brinde', 'Parabéns', 'Churrasco', 'Open bar', 'Pagode', 'Sertanejo',
      'Forró', 'Funk', 'Samba', 'Micareta', 'Halloween', 'Natal', 'Páscoa', 'Chá revelação',
      'Despedida de solteiro', 'Batizado', 'Lua de mel',
    ],
  },
  {
    id: 'transporte',
    label: 'Transportes',
    words: [
      'Avião', 'Helicóptero', 'Bicicleta', 'Moto', 'Ônibus', 'Metrô', 'Trem', 'Navio',
      'Submarino', 'Foguete', 'Caminhão', 'Táxi', 'Ambulância', 'Carro de bombeiro',
      'Patinete', 'Balão de ar quente', 'Jet ski', 'Canoa', 'Teleférico', 'Trator', 'Carroça',
      'Lancha', 'Kart', 'Limusine', 'Van', 'Bonde', 'Carrinho de supermercado',
      'Disco voador', 'Tanque de guerra', 'Monociclo', 'Trenó', 'Carrinho de bebê',
      'Escada rolante', 'Jangada', 'Caiaque', 'Avião de papel', 'Ultraleve',
    ],
  },
];

export const ALL = { id: 'tudo', label: 'Tudo' };

const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const labelFor = (id) => (id === ALL.id ? ALL.label : byId[id]?.label ?? ALL.label);

// Lista de { word, cat } para o tema escolhido ("tudo" junta todos os temas, sem repetir palavra).
export function poolFor(catId) {
  const cats = byId[catId] ? [byId[catId]] : CATEGORIES;
  const seen = new Set();
  const pool = [];
  for (const c of cats) {
    for (const word of c.words) {
      const k = word.toLocaleLowerCase('pt-BR');
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push({ word, cat: c.id });
    }
  }
  return pool;
}
