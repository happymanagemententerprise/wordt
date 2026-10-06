using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace WordtGame;

public class PlayerInfo
{
    public string ConnectionId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public HashSet<char> SelectedLetters { get; set; } = new();
    public List<string> SubmittedWords { get; set; } = new();
    public int Score { get; set; }
}

public class GameRoom
{
    public string RoomCode { get; set; } = "WORDT";
    public string HostConnectionId { get; set; } = string.Empty;
    public ConcurrentDictionary<string, PlayerInfo> Players { get; set; } = new();
    public string GameState { get; set; } = "LOBBY";
    public Dictionary<char, int> LetterCounts { get; set; } = new();
    public Dictionary<char, int> LetterPoints { get; set; } = new();
    public int TimerSeconds { get; set; } = 120;
}

public class GameHub : Hub
{
    private static readonly GameRoom ActiveRoom = new GameRoom();

    public async Task RegisterHost()
    {
        ActiveRoom.HostConnectionId = Context.ConnectionId;
        await Clients.Caller.SendAsync("HostRegistered", ActiveRoom);
    }

    public async Task JoinGame(string playerName)
    {
        if (ActiveRoom.GameState != "LOBBY")
        {
            await Clients.Caller.SendAsync("Error", "Game has already started.");
            return;
        }

        var player = new PlayerInfo
        {
            ConnectionId = Context.ConnectionId,
            Name = string.IsNullOrWhiteSpace(playerName) ? $"Player {ActiveRoom.Players.Count + 1}" : playerName.Trim()
        };

        ActiveRoom.Players[Context.ConnectionId] = player;

        if (!string.IsNullOrEmpty(ActiveRoom.HostConnectionId))
        {
            await Clients.Client(ActiveRoom.HostConnectionId).SendAsync("PlayerJoined", player.Name, ActiveRoom.Players.Count);
        }
        await Clients.Caller.SendAsync("JoinedSuccessfully", player.Name);
    }

    public async Task StartDrafting()
    {
        if (Context.ConnectionId != ActiveRoom.HostConnectionId) return;
        ActiveRoom.GameState = "DRAFTING";
        await Clients.All.SendAsync("GameStateChanged", "DRAFTING");
    }

    public async Task SubmitLetters(List<char> letters)
    {
        if (!ActiveRoom.Players.TryGetValue(Context.ConnectionId, out var player)) return;

        var cleanLetters = letters.Select(char.ToUpper).Distinct().Where(char.IsLetter).Take(7).ToHashSet();
        if (cleanLetters.Count != 7)
        {
            await Clients.Caller.SendAsync("Error", "You must select exactly 7 unique letters.");
            return;
        }

        player.SelectedLetters = cleanLetters;
        await Clients.Caller.SendAsync("LettersAccepted", cleanLetters);

        int submittedCount = ActiveRoom.Players.Values.Count(p => p.SelectedLetters.Count == 7);
        if (!string.IsNullOrEmpty(ActiveRoom.HostConnectionId))
        {
            await Clients.Client(ActiveRoom.HostConnectionId).SendAsync("DraftProgressUpdated", submittedCount, ActiveRoom.Players.Count);
        }

        if (submittedCount == ActiveRoom.Players.Count && ActiveRoom.Players.Count >= 1)
        {
            CalculatePoolAndPoints();
            ActiveRoom.GameState = "PLAYING";
            await Clients.All.SendAsync("StartWordPhase", ActiveRoom.LetterCounts, ActiveRoom.LetterPoints, ActiveRoom.TimerSeconds);
        }
    }

    public async Task SubmitWords(List<string> words)
    {
        if (!ActiveRoom.Players.TryGetValue(Context.ConnectionId, out var player)) return;

        player.SubmittedWords = words.Select(w => w.Trim().ToUpper()).Where(w => w.Length >= 2).Distinct().ToList();
        await Clients.Caller.SendAsync("WordsReceived");

        int score = 0;
        foreach (var word in player.SubmittedWords)
        {
            if (word.All(ch => ActiveRoom.LetterPoints.ContainsKey(ch)))
            {
                score += word.Sum(ch => ActiveRoom.LetterPoints[ch]);
            }
        }
        player.Score = score;

        int finishedCount = ActiveRoom.Players.Values.Count(p => p.SubmittedWords.Count > 0);
        if (!string.IsNullOrEmpty(ActiveRoom.HostConnectionId))
        {
            await Clients.Client(ActiveRoom.HostConnectionId).SendAsync("SubmissionsUpdated", finishedCount, ActiveRoom.Players.Count);
        }

        if (finishedCount == ActiveRoom.Players.Count)
        {
            ActiveRoom.GameState = "OVER";
            var leaderboard = ActiveRoom.Players.Values.OrderByDescending(p => p.Score).ToList();
            await Clients.All.SendAsync("GameOver", leaderboard);
        }
    }

    private static void CalculatePoolAndPoints()
    {
        ActiveRoom.LetterCounts.Clear();
        ActiveRoom.LetterPoints.Clear();

        foreach (var p in ActiveRoom.Players.Values)
        {
            foreach (var ch in p.SelectedLetters)
            {
                ActiveRoom.LetterCounts[ch] = ActiveRoom.LetterCounts.GetValueOrDefault(ch, 0) + 1;
            }
        }

        if (ActiveRoom.LetterCounts.Count == 0) return;

        int maxPick = ActiveRoom.LetterCounts.Values.Max();
        int minPick = ActiveRoom.LetterCounts.Values.Min();

        foreach (var (letter, count) in ActiveRoom.LetterCounts)
        {
            if (maxPick == minPick)
            {
                ActiveRoom.LetterPoints[letter] = 5;
            }
            else
            {
                double normalized = (double)(count - minPick) / (maxPick - minPick);
                double scaledValue = 5.0 - (4.0 * normalized);
                ActiveRoom.LetterPoints[letter] = (int)Math.Round(scaledValue, MidpointRounding.AwayFromZero);
            }
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        ActiveRoom.Players.TryRemove(Context.ConnectionId, out _);
        if (!string.IsNullOrEmpty(ActiveRoom.HostConnectionId))
        {
            await Clients.Client(ActiveRoom.HostConnectionId).SendAsync("PlayerLeft", ActiveRoom.Players.Count);
        }
        await base.OnDisconnectedAsync(exception);
    }
}