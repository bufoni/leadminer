import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Score Badge Component
export const ScoreBadge = ({ score, size = 'md' }) => {
  const getScoreColor = (score) => {
    if (score >= 70) return 'from-green-500 to-emerald-500';
    if (score >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-blue-500 to-cyan-500';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Quente';
    if (score >= 40) return 'Morno';
    return 'Frio';
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg'
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br ${getScoreColor(score)} flex items-center justify-center font-bold text-white shadow-lg`}>
      {score}
    </div>
  );
};

// Detailed Score Card Component
export const ScoreCard = ({ score, breakdown }) => {
  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const getBarColor = (score) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const breakdownLabels = {
    followers: '📊 Seguidores',
    email: '📧 Email',
    phone: '📱 Telefone',
    keywords: '🔑 Keywords',
    bio_quality: '📝 Bio',
    profile_complete: '✅ Perfil'
  };

  const maxScores = {
    followers: 25,
    email: 25,
    phone: 15,
    keywords: 20,
    bio_quality: 10,
    profile_complete: 10
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm font-medium">Lead Score</span>
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
      </div>
      
      <div className="space-y-3">
        {breakdown && Object.entries(breakdown).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">{breakdownLabels[key] || key}</span>
              <span className="text-gray-300">{value}/{maxScores[key] || 25}</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getBarColor(score)} rounded-full transition-all duration-500`}
                style={{ width: `${(value / (maxScores[key] || 25)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Classificação automática</span>
          <span className={`font-medium ${getScoreColor(score)}`}>
            {score >= 70 ? '🔥 Quente' : score >= 40 ? '⚡ Morno' : '❄️ Frio'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Score with Tooltip
export const ScoreWithTooltip = ({ score, breakdown }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">
            <ScoreBadge score={score} size="md" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="p-0 bg-transparent border-none">
          <ScoreCard score={score} breakdown={breakdown} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Score Stats Summary Component
export const ScoreStatsSummary = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-white">{stats.average_score}</div>
        <div className="text-sm text-gray-400">Score Médio</div>
      </div>
      <div className="bg-gray-900/50 border border-green-900/50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-green-400">{stats.hot_leads}</div>
        <div className="text-sm text-gray-400">🔥 Quentes</div>
      </div>
      <div className="bg-gray-900/50 border border-yellow-900/50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-yellow-400">{stats.warm_leads}</div>
        <div className="text-sm text-gray-400">⚡ Mornos</div>
      </div>
      <div className="bg-gray-900/50 border border-blue-900/50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-blue-400">{stats.cold_leads}</div>
        <div className="text-sm text-gray-400">❄️ Frios</div>
      </div>
    </div>
  );
};

export default ScoreBadge;
