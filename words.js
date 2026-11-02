// Palavras do jogo, separadas por tema e por nível de dificuldade.
// Para adicionar palavras, inclua na lista do tema e do nível (uma palavra ou expressão curta).
//
// Fácil: coisas do dia a dia.  Médio: conhecidas, mas menos óbvias.
// Difícil: coisas específicas e pouco comuns.  Impossível: ideias abstratas e coisas raras,
// difíceis de dar dica sem entregar (e fáceis do impostor se esconder).

export const LEVELS = [
  { id: 'facil', label: 'Fácil', note: 'Coisas do dia a dia, que todo mundo conhece.' },
  { id: 'medio', label: 'Médio', note: 'Palavras conhecidas, mas menos óbvias.' },
  { id: 'dificil', label: 'Difícil', note: 'Coisas específicas e pouco comuns.' },
  { id: 'impossivel', label: 'Impossível', note: 'Ideias abstratas e coisas raras. Boa sorte.' },
];

export const DEFAULT_LEVEL = 'medio';

export const CATEGORIES = [
  {
    id: 'comida',
    label: 'Comida',
    words: {
      facil: [
        'Pizza', 'Hambúrguer', 'Brigadeiro', 'Coxinha', 'Pão de queijo', 'Pipoca', 'Sorvete',
        'Chocolate', 'Macarrão', 'Batata frita', 'Cachorro-quente', 'Arroz e feijão', 'Salada',
        'Sopa', 'Melancia', 'Abacaxi', 'Banana', 'Morango', 'Café', 'Pastel', 'Lasanha',
        'Bolo de cenoura', 'Omelete', 'Torrada', 'Manga', 'Sushi', 'Açaí', 'Pudim', 'Feijoada',
        'Panqueca', 'Pão francês', 'Maçã', 'Uva', 'Leite', 'Suco de laranja', 'Biscoito',
        'Queijo', 'Misto-quente', 'Frango assado', 'Gelatina',
      ],
      medio: [
        'Moqueca', 'Acarajé', 'Strogonoff', 'Farofa', 'Esfiha', 'Cuscuz', 'Pamonha', 'Picanha',
        'Pé de moleque', 'Paçoca', 'Beijinho', 'Tapioca', 'Guaraná', 'Água de coco', 'Chimarrão',
        'Milkshake', 'Escondidinho', 'Baião de dois', 'Galinhada', 'Quindim', 'Canjica', 'Curau',
        'Mousse de maracujá', 'Torta de limão', 'Empadão', 'Caldo de cana', 'Quibe', 'Polenta',
        'Nhoque', 'Risoto', 'Churros', 'Sagu', 'Romeu e julieta', 'Arroz carreteiro', 'Mortadela',
        'Jabuticaba', 'Goiabada',
      ],
      dificil: [
        'Vatapá', 'Tacacá', 'Maniçoba', 'Pequi', 'Cupuaçu', 'Tiramisu', 'Fondue', 'Ceviche',
        'Guacamole', 'Tempurá', 'Creme brûlée', 'Quiche', 'Paella', 'Ratatouille', 'Carpaccio',
        'Shimeji', 'Wasabi', 'Rabada', 'Sarapatel', 'Tutu de feijão', 'Cocada', 'Bolo de rolo',
        'Pato no tucupi', 'Caruru', 'Mungunzá', 'Falafel', 'Bobó de camarão', 'Buchada de bode',
      ],
      impossivel: [
        'Umami', 'Banho-maria', 'Al dente', 'Ponto de bala', 'Fermentação', 'Caramelização',
        'Glúten', 'Lactose', 'Escargot', 'Foie gras', 'Caviar', 'Trufa negra', 'Kombucha', 'Kimchi',
        'Gazpacho', 'Shakshuka', 'Steak tartare', 'Sous-vide', 'Tahine', 'Fermento natural',
        'Marinada', 'Flambado',
      ],
    },
  },
  {
    id: 'lugares',
    label: 'Lugares',
    words: {
      facil: [
        'Praia', 'Aeroporto', 'Hospital', 'Escola', 'Cinema', 'Supermercado', 'Academia', 'Shopping',
        'Padaria', 'Farmácia', 'Zoológico', 'Restaurante', 'Piscina', 'Parque de diversões',
        'Fazenda', 'Floresta', 'Montanha', 'Escritório', 'Banco', 'Igreja', 'Hotel', 'Estádio',
        'Banheiro', 'Cozinha', 'Parquinho', 'Garagem', 'Sorveteria',
      ],
      medio: [
        'Biblioteca', 'Museu', 'Delegacia', 'Posto de gasolina', 'Rodoviária', 'Cemitério',
        'Salão de beleza', 'Navio de cruzeiro', 'Circo', 'Feira', 'Lavanderia', 'Cachoeira',
        'Ilha deserta', 'Elevador', 'Sauna', 'Prisão', 'Castelo', 'Deserto', 'Faculdade', 'Pet shop',
        'Oficina mecânica', 'Barbearia', 'Lan house', 'Estação espacial', 'Pronto-socorro',
        'Floricultura', 'Camarote', 'Cristo Redentor', 'Torre Eiffel', 'Pirâmides do Egito',
      ],
      dificil: [
        'Cartório', 'Autoescola', 'Planetário', 'Aquário', 'Observatório', 'Farol', 'Vulcão',
        'Caverna', 'Pântano', 'Geleira', 'Manguezal', 'Vinícola', 'Sambódromo', 'Mosteiro', 'Ateliê',
        'Estúdio de tatuagem', 'Brechó', 'Hemocentro', 'Casa de câmbio', 'Sebo', 'Haras',
        'Usina hidrelétrica', 'Ferro-velho', 'Oásis', 'Muralha da China', 'Coliseu',
        'Estátua da Liberdade', 'Machu Picchu', 'Pão de Açúcar', 'Lençóis Maranhenses', 'Pantanal',
      ],
      impossivel: [
        'Triângulo das Bermudas', 'Fossa das Marianas', 'Linha do Equador', 'Área 51', 'Atlântida',
        'Limbo', 'Purgatório', 'Metaverso', 'Catacumba', 'Bunker', 'Duty free', 'Embaixada',
        'Bolsa de valores', 'Data center', 'Torre de controle', 'Estação de tratamento de esgoto',
        'Sala de espelhos', 'Labirinto', 'Stonehenge', 'Sótão', 'Porão', 'Cofre de banco',
      ],
    },
  },
  {
    id: 'animais',
    label: 'Animais',
    words: {
      facil: [
        'Cachorro', 'Gato', 'Elefante', 'Girafa', 'Leão', 'Tubarão', 'Pinguim', 'Macaco', 'Cavalo',
        'Vaca', 'Galinha', 'Baleia', 'Golfinho', 'Formiga', 'Abelha', 'Borboleta', 'Cobra',
        'Tartaruga', 'Coelho', 'Urso', 'Sapo', 'Papagaio', 'Zebra', 'Porco', 'Ovelha', 'Pato',
        'Peixe', 'Rato', 'Mosquito', 'Barata', 'Aranha',
      ],
      medio: [
        'Jacaré', 'Capivara', 'Tucano', 'Arara', 'Onça-pintada', 'Coruja', 'Polvo', 'Lobo', 'Camelo',
        'Canguru', 'Bicho-preguiça', 'Morcego', 'Flamingo', 'Rinoceronte', 'Hipopótamo',
        'Lagartixa', 'Caranguejo', 'Tamanduá', 'Mico-leão-dourado', 'Esquilo', 'Raposa', 'Pavão',
        'Avestruz', 'Tigre', 'Gorila', 'Panda', 'Lhama', 'Joaninha', 'Minhoca', 'Água-viva',
        'Cavalo-marinho', 'Estrela-do-mar', 'Peixe-palhaço',
      ],
      dificil: [
        'Ornitorrinco', 'Suricato', 'Lêmure', 'Bicho-pau', 'Louva-a-deus', 'Ouriço', 'Texugo',
        'Castor', 'Lontra', 'Morsa', 'Peixe-boi', 'Boto-cor-de-rosa', 'Arraia', 'Lagosta', 'Tatu',
        'Quati', 'Ariranha', 'Iguana', 'Camaleão', 'Salamandra', 'Escorpião', 'Vaga-lume', 'Cigarra',
        'Gafanhoto', 'Urubu', 'Beija-flor', 'Pica-pau', 'Jabuti', 'Gambá', 'Hiena',
      ],
      impossivel: [
        'Axolote', 'Pangolim', 'Narval', 'Tardígrado', 'Peixe-bolha', 'Diabo-da-tasmânia', 'Dodô',
        'Mamute', 'Ácaro', 'Ameba', 'Plâncton', 'Krill', 'Camuflagem', 'Hibernação', 'Metamorfose',
        'Migração', 'Cadeia alimentar', 'Extinção', 'Mimetismo', 'Ecolocalização', 'Polinização',
        'Fóssil', 'Teia de aranha', 'Colmeia',
      ],
    },
  },
  {
    id: 'objetos',
    label: 'Objetos',
    words: {
      facil: [
        'Celular', 'Escova de dentes', 'Óculos', 'Relógio', 'Chave', 'Travesseiro', 'Controle remoto',
        'Mochila', 'Tesoura', 'Espelho', 'Geladeira', 'Chinelo', 'Boné', 'Cadeira', 'Bola',
        'Cobertor', 'Garfo', 'Caneta', 'Livro', 'Sofá', 'Televisão', 'Guarda-chuva', 'Cama', 'Mesa',
        'Copo', 'Prato', 'Colher', 'Sabonete', 'Toalha', 'Lápis', 'Janela',
      ],
      medio: [
        'Garrafa térmica', 'Vela', 'Lanterna', 'Carregador', 'Fone de ouvido', 'Panela de pressão',
        'Ventilador', 'Liquidificador', 'Violão', 'Câmera fotográfica', 'Martelo', 'Vassoura',
        'Secador de cabelo', 'Microfone', 'Calculadora', 'Abajur', 'Mala', 'Rede', 'Notebook', 'Pente',
        'Batom', 'Perfume', 'Guarda-roupa', 'Escada', 'Cofrinho', 'Varal', 'Prendedor de roupa',
        'Ferro de passar', 'Cabide', 'Balde', 'Mangueira', 'Guarda-sol', 'Despertador', 'Pen drive',
        'Cubo mágico', 'Pau de selfie',
      ],
      dificil: [
        'Grampeador', 'Clipe de papel', 'Fita adesiva', 'Estetoscópio', 'Termômetro', 'Bússola',
        'Ampulheta', 'Lupa', 'Binóculo', 'Abridor de latas', 'Saca-rolhas', 'Ralador', 'Peneira',
        'Funil', 'Rolo de massa', 'Batedeira', 'Cortador de unha', 'Pinça', 'Alicate',
        'Chave de fenda', 'Furadeira', 'Fita métrica', 'Extintor de incêndio', 'Cadeado', 'Dedal',
        'Régua', 'Apontador', 'Borracha', 'Estilingue', 'Ioiô', 'Pião',
      ],
      impossivel: [
        'Metrônomo', 'Diapasão', 'Caleidoscópio', 'Pêndulo de Newton', 'Ábaco', 'Gramofone',
        'Disquete', 'Fita cassete', 'Máquina de escrever', 'Mimeógrafo', 'Lamparina', 'Periscópio',
        'Prisma', 'Ímã', 'Bumerangue', 'Cata-vento', 'Filtro dos sonhos', 'Matrioska', 'Tripé',
        'Mata-borrão', 'Sino', 'Pedra de amolar',
      ],
    },
  },
  {
    id: 'profissoes',
    label: 'Profissões',
    words: {
      facil: [
        'Médico', 'Professor', 'Bombeiro', 'Policial', 'Cozinheiro', 'Piloto de avião', 'Dentista',
        'Jogador de futebol', 'Cantor', 'Ator', 'Motorista de ônibus', 'Padeiro', 'Cabeleireiro',
        'Veterinário', 'Astronauta', 'Garçom', 'Enfermeiro', 'Carteiro', 'Palhaço', 'Mágico',
        'Pescador', 'Taxista', 'Vendedor', 'Pintor', 'Agricultor', 'Youtuber',
      ],
      medio: [
        'Advogado', 'Mecânico', 'Eletricista', 'Jardineiro', 'Fotógrafo', 'Jornalista', 'Programador',
        'Engenheiro', 'Arquiteto', 'Pedreiro', 'Juiz', 'Salva-vidas', 'Detetive', 'Personal trainer',
        'Psicólogo', 'DJ', 'Manicure', 'Segurança', 'Costureira', 'Cientista', 'Encanador',
        'Chaveiro', 'Frentista', 'Bibliotecário', 'Comissário de bordo', 'Guia turístico', 'Babá',
        'Porteiro', 'Recepcionista', 'Massagista', 'Tatuador', 'Confeiteiro', 'Influenciador digital',
      ],
      dificil: [
        'Contador', 'Economista', 'Farmacêutico', 'Fisioterapeuta', 'Nutricionista', 'Fonoaudiólogo',
        'Arqueólogo', 'Astrônomo', 'Geólogo', 'Biólogo marinho', 'Meteorologista', 'Tradutor',
        'Locutor', 'Dublador', 'Roteirista', 'Cenógrafo', 'Maquiador', 'Sommelier', 'Barista',
        'Açougueiro', 'Sapateiro', 'Marceneiro', 'Vidraceiro', 'Soldador', 'Leiloeiro',
        'Corretor de imóveis', 'Despachante', 'Mergulhador',
      ],
      impossivel: [
        'Ourives', 'Cartógrafo', 'Taxidermista', 'Apicultor', 'Luthier', 'Enólogo', 'Ferreiro',
        'Relojoeiro', 'Afinador de piano', 'Restaurador de obras de arte', 'Ventríloquo', 'Dublê',
        'Paparazzo', 'Tabelião', 'Oficial de justiça', 'Cerimonialista', 'Calígrafo', 'Perfumista',
        'Perito criminal', 'Astrólogo', 'Tarólogo', 'Ombudsman',
      ],
    },
  },
  {
    id: 'lazer',
    label: 'Esportes e lazer',
    words: {
      facil: [
        'Futebol', 'Vôlei', 'Basquete', 'Natação', 'Skate', 'Corrida', 'Ciclismo', 'Boxe', 'Xadrez',
        'Videogame', 'Pipa', 'Esconde-esconde', 'Amarelinha', 'Quebra-cabeça', 'Pega-pega',
        'Tênis', 'Karaokê', 'Boliche', 'Pescaria', 'Yoga', 'Musculação', 'Dominó', 'Piquenique',
        'Camping', 'Jogo da velha', 'Desenhar',
      ],
      medio: [
        'Surfe', 'Judô', 'Capoeira', 'Escalada', 'Paraquedismo', 'Golfe', 'Sinuca', 'Futevôlei',
        'Patinação', 'Truco', 'Pingue-pongue', 'Handebol', 'Mergulho', 'Asa-delta', 'Trilha', 'Balé',
        'Queimada', 'Crochê', 'Jardinagem', 'Maratona', 'Bambolê', 'Caratê', 'Hipismo', 'Rapel',
        'Stand-up paddle', 'Tirolesa', 'Jiu-jítsu', 'Futsal', 'Bingo', 'Palavras cruzadas',
        'Cabo de guerra',
      ],
      dificil: [
        'Esgrima', 'Polo aquático', 'Nado sincronizado', 'Arco e flecha', 'Remo', 'Canoagem',
        'Triatlo', 'Salto com vara', 'Arremesso de peso', 'Ginástica rítmica', 'Ginástica artística',
        'Badminton', 'Beisebol', 'Rúgbi', 'Críquete', 'Hóquei no gelo', 'Bocha', 'Peteca', 'Bilboquê',
        'Tricô', 'Origami', 'Parkour', 'Slackline', 'Kitesurfe', 'Bodyboard', 'Sudoku', 'Damas',
        'Gamão', 'Pôquer', 'Bolinha de gude',
      ],
      impossivel: [
        'Curling', 'Biatlo', 'Pentatlo moderno', 'Lacrosse', 'Squash', 'Skeleton', 'Bobsled',
        'Corrida de orientação', 'Mahjong', 'Tangram', 'Cama de gato', 'Cinco Marias', 'Bafo',
        'Taco', 'Pique-bandeira', 'Adedonha', 'Telefone sem fio', 'Mímica', 'Batalha naval',
        'Levantamento de peso', 'Xadrez às cegas',
      ],
    },
  },
  {
    id: 'festa',
    label: 'Festa',
    words: {
      facil: [
        'Aniversário', 'Casamento', 'Carnaval', 'Festa junina', 'Réveillon', 'Natal', 'Páscoa',
        'Show', 'Balão', 'Bolo de aniversário', 'Fantasia', 'Fogos de artifício', 'Parabéns',
        'Churrasco', 'Halloween', 'Presente', 'Vela de aniversário', 'Docinhos', 'Pista de dança',
        'Amigo secreto', 'Formatura', 'Cerveja', 'Refrigerante', 'Convite', 'Música alta',
      ],
      medio: [
        'Balada', 'Chá de bebê', 'Happy hour', 'Luau', 'Bloco de rua', 'Quentão', 'Caipirinha',
        'Vinho', 'Chope', 'Champanhe', 'Confete', 'Ressaca', 'Selfie', 'Brinde', 'Open bar', 'Pagode',
        'Sertanejo', 'Forró', 'Funk', 'Samba', 'Micareta', 'Chá revelação', 'Despedida de solteiro',
        'Batizado', 'Lua de mel', 'Quadrilha', 'Serpentina', 'Abadá', 'Trio elétrico', 'Buquê',
      ],
      dificil: [
        'Correio elegante', 'Pau de sebo', 'Bem-casado', 'Lembrancinha', 'Mestre de cerimônias',
        'Chuva de arroz', 'Valsa de 15 anos', 'Debutante', 'Pulseirinha VIP', 'Penetra', 'Saideira',
        'Esquenta', 'Rave', 'Baile de máscaras', 'Arraiá', 'Fogueira', 'Bandeirinha', 'Pinhata',
        'Língua de sogra', 'Chapéu de aniversário', 'Gincana', 'Mestre-sala', 'Porta-bandeira',
        'Dama de honra', 'Padrinho de casamento', 'Pajem',
      ],
      impossivel: [
        'Bodas de ouro', 'Bodas de prata', 'Pular sete ondas', 'Lentilha de Ano-Novo', 'Simpatia',
        'Folia de Reis', 'Bumba meu boi', 'Festival de Parintins', 'Círio de Nazaré', 'Cavalhada',
        'Congada', 'Oktoberfest', 'Dia dos Mortos', 'Hanukkah', 'Ano-Novo chinês', 'Mardi Gras',
        'Holi', 'Festa do Divino', 'Lavagem do Bonfim', 'After', 'Bate-volta',
      ],
    },
  },
  {
    id: 'transporte',
    label: 'Transportes',
    words: {
      facil: [
        'Avião', 'Helicóptero', 'Bicicleta', 'Moto', 'Ônibus', 'Metrô', 'Trem', 'Navio', 'Foguete',
        'Caminhão', 'Táxi', 'Ambulância', 'Carro de bombeiro', 'Patinete', 'Carro', 'Barco',
        'Viatura de polícia', 'Carrinho de bebê', 'Carrinho de supermercado', 'Escada rolante',
        'Trator', 'Van', 'Lancha',
      ],
      medio: [
        'Submarino', 'Balão de ar quente', 'Jet ski', 'Canoa', 'Teleférico', 'Carroça', 'Kart',
        'Limusine', 'Bonde', 'Disco voador', 'Tanque de guerra', 'Monociclo', 'Trenó', 'Jangada',
        'Caiaque', 'Avião de papel', 'Ultraleve', 'Mototáxi', 'Carro de aplicativo', 'Iate', 'Veleiro',
        'Balsa', 'Guincho', 'Betoneira', 'Empilhadeira', 'Patins', 'Triciclo',
      ],
      dificil: [
        'Dirigível', 'Planador', 'Riquixá', 'Gôndola', 'Tuk-tuk', 'Locomotiva a vapor', 'Trem-bala',
        'Caravela', 'Catamarã', 'Rebocador', 'Porta-aviões', 'Quadriciclo', 'Segway', 'Parapente',
        'Charrete', 'Carro alegórico', 'Drone', 'Ônibus espacial', 'Sonda espacial', 'Esteira rolante',
        'Hovercraft', 'Bote salva-vidas',
      ],
      impossivel: [
        'Teletransporte', 'Máquina do tempo', 'Tapete voador', 'Vassoura de bruxa', 'Carro voador',
        'Hyperloop', 'Elevador espacial', 'Perna de pau', 'Pogobol', 'Carrinho de rolimã',
        'Carrinho de mão', 'Liteira', 'Paraquedas', 'Boia', 'Esqui', 'Zepelim', 'Navio fantasma',
        'Carona', 'Engarrafamento', 'Pedágio',
      ],
    },
  },
  {
    id: 'ideias',
    label: 'Sentimentos e ideias',
    words: {
      facil: [
        'Amor', 'Medo', 'Alegria', 'Tristeza', 'Raiva', 'Sono', 'Fome', 'Sede', 'Frio', 'Calor',
        'Sorte', 'Cansaço', 'Sonho', 'Pesadelo', 'Amizade', 'Surpresa', 'Dor', 'Cócegas', 'Risada',
        'Choro', 'Preguiça', 'Tédio', 'Pressa', 'Beijo', 'Abraço',
      ],
      medio: [
        'Saudade', 'Ciúme', 'Vergonha', 'Orgulho', 'Paciência', 'Coragem', 'Esperança', 'Inveja',
        'Nervosismo', 'Paixão', 'Confiança', 'Gratidão', 'Liberdade', 'Silêncio', 'Mentira', 'Segredo',
        'Promessa', 'Fofoca', 'Azar', 'Arrependimento', 'Teimosia', 'Curiosidade', 'Timidez',
        'Desculpa', 'Fama',
      ],
      dificil: [
        'Nostalgia', 'Ansiedade', 'Ironia', 'Sarcasmo', 'Empatia', 'Culpa', 'Rancor', 'Desconfiança',
        'Ambição', 'Humildade', 'Vaidade', 'Tolerância', 'Justiça', 'Destino', 'Intuição',
        'Inspiração', 'Criatividade', 'Memória', 'Imaginação', 'Rotina', 'Hábito', 'Tradição', 'Fé',
        'Ego', 'Sabedoria',
      ],
      impossivel: [
        'Déjà vu', 'Procrastinação', 'Efeito borboleta', 'Paradoxo', 'Livre-arbítrio', 'Serendipidade',
        'Entropia', 'Placebo', 'Síndrome do impostor', 'Vergonha alheia', 'Zona de conforto',
        'Burocracia', 'Carma', 'Ressaca moral', 'Epifania', 'Melancolia', 'Utopia', 'Dilema',
        'Coincidência', 'Infinito', 'Caos', 'Gravidade', 'Telepatia', 'Sexto sentido',
        'Fuso horário', 'Horário de verão',
      ],
    },
  },
];

export const ALL = { id: 'tudo', label: 'Tudo' };

const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const levelIds = new Set(LEVELS.map((l) => l.id));

export const labelFor = (id) => (id === ALL.id ? ALL.label : byId[id]?.label ?? ALL.label);
export const levelOf = (id) => (levelIds.has(id) ? id : DEFAULT_LEVEL);
export const levelLabel = (id) => LEVELS.find((l) => l.id === levelOf(id)).label;

// Lista de { word, cat } para o tema e o nível escolhidos ("tudo" junta todos os temas, sem repetir palavra).
export function poolFor(catId, level = DEFAULT_LEVEL) {
  const lv = levelOf(level);
  const cats = byId[catId] ? [byId[catId]] : CATEGORIES;
  const seen = new Set();
  const pool = [];
  for (const c of cats) {
    for (const word of c.words[lv]) {
      const k = word.toLocaleLowerCase('pt-BR');
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push({ word, cat: c.id });
    }
  }
  return pool;
}
